import assert from "node:assert/strict";
import test from "node:test";
import { StickyDrafts } from "../drafts.ts";
const row = { html: "<p>Initial</p>", backgroundColor: "gray", updatedAt: 10 };
test("two presentations share a serial draft and only exact own acknowledgements advance CAS", async () => {
  const calls: { revision: number; html?: string; backgroundColor?: string }[] = [];
  let resolve!: (value: { updatedAt: number }) => void;
  const drafts = new StickyDrafts(
    async (_id, revision, patch) => {
      calls.push({ revision, ...patch });
      if (calls.length === 1)
        return new Promise((done) => {
          resolve = done;
        });
      return { updatedAt: 12 };
    },
    () => {}
  );
  drafts.observe("note", row);
  drafts.edit("note", { html: "<p>First</p>" });
  const saving = drafts.flush("note");
  drafts.edit("note", { backgroundColor: "pink" });
  drafts.observe("note", { ...row, updatedAt: 99, html: "<p>Peer</p>" });
  assert.equal(drafts.get("note")?.html, "<p>First</p>");
  resolve({ updatedAt: 11 });
  await saving;
  assert.deepEqual(calls, [
    { revision: 10, html: "<p>First</p>" },
    { revision: 11, backgroundColor: "pink" },
  ]);
  drafts.observe("note", row);
  assert.equal(drafts.get("note")?.updatedAt, 12);
  assert.equal(drafts.hasUnsaved(), false);
  drafts.dispose();
});
test("conflict preserves text, blocks leaving, retries captured revision, then explicit discard accepts saved content", async () => {
  const revisions: number[] = [];
  const drafts = new StickyDrafts(
    async (_id, revision) => {
      revisions.push(revision);
      throw new Error("Changed elsewhere");
    },
    () => {}
  );
  drafts.observe("note", row);
  drafts.edit("note", { html: "<p>Unsaved</p>" });
  await drafts.flush("note");
  drafts.observe("note", { ...row, updatedAt: 20, html: "<p>Remote</p>" });
  assert.equal(drafts.get("note")?.html, "<p>Unsaved</p>");
  await assert.rejects(drafts.flushAll(), /unsaved/);
  await drafts.retry("note");
  assert.deepEqual(revisions, [10, 10]);
  drafts.discard("note", { ...row, updatedAt: 20, html: "<p>Remote</p>" });
  assert.equal(drafts.get("note")?.html, "<p>Remote</p>");
  assert.equal(drafts.hasUnsaved(), false);
  drafts.dispose();
});
test("clean shared presentation follows a newer reactive row without remount or changing an older acknowledgement", () => {
  const drafts = new StickyDrafts(
    async () => ({ updatedAt: 11 }),
    () => {}
  );
  drafts.observe("note", row);
  drafts.observe("note", { ...row, updatedAt: 15, html: "<p>Peer edit</p>" });
  assert.equal(drafts.get("note")?.html, "<p>Peer edit</p>");
  drafts.dispose();
});

test("viewing an unchanged note never queues a save; unmount does not flush a pending edit", async () => {
  let calls = 0;
  const drafts = new StickyDrafts(
    async () => {
      calls++;
      return { updatedAt: 11 };
    },
    () => {}
  );
  drafts.observe("note", row);
  drafts.edit("note", { html: row.html });
  assert.equal(drafts.hasUnsaved(), false);
  await drafts.flushAll();
  assert.equal(calls, 0);
  drafts.edit("note", { html: "<p>Leaving</p>" });
  drafts.dispose();
  await drafts.flush("note");
  assert.equal(calls, 0);
});

test("moving uses its own acknowledgement before saving edits queued during the move", async () => {
  const revisions: number[] = [];
  let moved!: (value: { updatedAt: number }) => void;
  const drafts = new StickyDrafts(
    async (_id, revision) => {
      revisions.push(revision);
      return { updatedAt: 12 };
    },
    () => {}
  );
  drafts.observe("note", row);
  const moving = drafts.changeRevision("note", async (revision) => {
    assert.equal(revision, 10);
    return new Promise((resolve) => {
      moved = resolve;
    });
  });
  drafts.edit("note", { html: "<p>After moving</p>" });
  await drafts.flush("note");
  assert.deepEqual(revisions, []);
  moved({ updatedAt: 11 });
  await moving;
  assert.deepEqual(revisions, [11]);
  assert.equal(drafts.get("note")?.html, "<p>After moving</p>");
  assert.equal(drafts.get("note")?.updatedAt, 12);
  drafts.dispose();
});
