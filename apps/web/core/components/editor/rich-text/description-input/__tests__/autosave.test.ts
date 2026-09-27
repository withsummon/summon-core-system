import assert from "node:assert/strict";
import test from "node:test";
import { DescriptionAutosave } from "../autosave.ts";
const draft = (description_html: string) => ({ description_html, isMigrationUpdate: false });

test("clean remote updates apply, while dirty remote updates preserve the local draft", () => {
  const owner = new DescriptionAutosave("initial", async () => {});
  assert.equal(owner.receive("remote"), true);
  owner.edit(draft("local"));
  assert.equal(owner.receive("another remote"), false);
  assert.equal(owner.draft.description_html, "local");
});
test("an acknowledged save cannot clear text entered while the request was in flight", async () => {
  const sent: string[] = [];
  let finish!: () => void;
  const owner = new DescriptionAutosave("initial", async (value) => {
    sent.push(value.description_html);
    if (sent.length === 1)
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
  });
  owner.edit(draft("first"));
  const save = owner.save();
  owner.edit(draft("second"));
  assert.equal(owner.receive("first"), false);
  finish();
  await save;
  assert.equal(owner.dirty, true);
  assert.deepEqual(sent, ["first"]);
  await owner.save();
  assert.equal(owner.dirty, false);
  assert.deepEqual(sent, ["first", "second"]);
});
test("a due save queues behind the active request rather than racing it", async () => {
  let finish!: () => void;
  const sent: string[] = [];
  const owner = new DescriptionAutosave("initial", async (value) => {
    sent.push(value.description_html);
    if (sent.length === 1)
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
  });
  owner.edit(draft("first"));
  const first = owner.save();
  owner.edit(draft("second"));
  const queued = owner.save();
  assert.equal(first, queued);
  assert.deepEqual(sent, ["first"]);
  finish();
  await queued;
  assert.deepEqual(sent, ["first", "second"]);
  assert.equal(owner.dirty, false);
});
test("failure keeps the draft dirty, rejects callers and does not retry on unmount", async () => {
  let calls = 0;
  const owner = new DescriptionAutosave("initial", async () => {
    calls++;
    if (calls === 1) throw new Error("Conflict");
  });
  owner.edit(draft("local"));
  await assert.rejects(owner.save(), /Conflict/);
  assert.equal(owner.dirty, true);
  await assert.rejects(owner.save(), /Conflict/);
  assert.equal(calls, 1);
  assert.equal(owner.canFlushOnUnmount, false);
  assert.equal(owner.receive("remote"), false);
  owner.edit(draft("revised local"));
  assert.equal(owner.canFlushOnUnmount, true);
  await owner.save();
  assert.equal(owner.dirty, false);
});
test("switching entity owners cannot send an old in-flight flush through the new callback", async () => {
  const writes: string[] = [];
  let finish!: () => void;
  const oldOwner = new DescriptionAutosave("A initial", async (value) => {
    writes.push(`A:${value.description_html}`);
    if (writes.length === 1)
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
  });
  oldOwner.edit(draft("first"));
  const first = oldOwner.save();
  oldOwner.edit(draft("last before navigation"));
  const newOwner = new DescriptionAutosave("B initial", async (value) => {
    writes.push(`B:${value.description_html}`);
  });
  newOwner.setSubmit(async (value) => {
    writes.push(`B updated:${value.description_html}`);
  });
  const flush = oldOwner.save();
  assert.equal(first, flush);
  finish();
  await flush;
  newOwner.edit(draft("new entity text"));
  await newOwner.save();
  assert.deepEqual(writes, ["A:first", "A:last before navigation", "B updated:new entity text"]);
});
test("unmount while the same snapshot is in flight does not duplicate it", async () => {
  let calls = 0;
  let finish!: () => void;
  const owner = new DescriptionAutosave("initial", async () => {
    calls++;
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
  });
  owner.edit(draft("local"));
  const first = owner.save();
  const flush = owner.save();
  finish();
  await Promise.all([first, flush]);
  assert.equal(calls, 1);
});
