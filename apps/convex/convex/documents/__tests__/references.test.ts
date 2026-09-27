import { expect, test } from "vitest";
import {
  getBinaryDataFromDocumentEditorHTMLString,
  getAllDocumentFormatsFromDocumentEditorBinaryData,
} from "@plane/editor/lib";
import { api, internal } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { documentReferenceTokens } from "../reference_tokens";
import type { Id } from "../../_generated/dataModel";
const paginationOpts = { cursor: null, numItems: 100 };
async function fixture() {
  const f = await workspaceJourney();
  const documentId = await f.owner.mutation(api.documents.index.create, {
    workspaceId: f.workspaceId,
    name: "References",
    access: "public",
    isGlobal: true,
    projectIds: [],
    color: "",
    viewProps: {},
    logoProps: {},
    sortOrder: 0,
    category: "document",
    tags: [],
    clientId: null,
    opportunityId: null,
    externalId: null,
    externalSource: null,
  });
  const taskId = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Referenced task" });
  const save = async (count: number, revision: number) => {
    const content = Array.from({ length: count }, (_, i) => ({
      type: "mention",
      attrs: { id: `transaction-${i}`, entity_name: "issue", entity_identifier: taskId },
    }));
    await f.owner.mutation(api.documents.index.saveSnapshot, {
      documentId,
      expectedRevision: revision,
      descriptionBinary: new Uint8Array([1]).buffer,
      descriptionHtml: "<p>Reference snapshot</p>",
      descriptionJson: { type: "doc", content },
    });
    const snapshot = await f.owner.query(api.documents.index.snapshot, { documentId });
    return f.t.run(
      async (ctx) =>
        (await ctx.db
          .query("documentReferenceJobs")
          .withIndex("by_snapshot", (q) => q.eq("snapshotId", snapshot!._id))
          .unique())!._id
    );
  };
  async function complete(jobId: Id<"documentReferenceJobs">) {
    // Inspect the durable status before each sequential batch.
    // oxlint-disable-next-line no-await-in-loop
    while ((await f.t.run((ctx) => ctx.db.get(jobId)))?.status === "pending") {
      // Durable cursor progression must run sequentially.
      // oxlint-disable-next-line no-await-in-loop
      await f.t.mutation(internal.documents.references.step, { jobId });
    }
  }
  return { ...f, documentId, taskId, save, complete };
}
test("more than 500 references save normally and publish only after every bounded batch", async () => {
  const f = await fixture();
  const jobId = await f.save(600, 0);
  expect(
    (await f.owner.query(api.documents.references.issues, { documentId: f.documentId, paginationOpts })).status
  ).toBe("updating");
  await f.t.mutation(internal.documents.references.step, { jobId });
  expect((await f.t.run((ctx) => ctx.db.get(jobId)))?.cursor).toBe(50);
  expect(
    (await f.owner.query(api.documents.references.issues, { documentId: f.documentId, paginationOpts })).page
  ).toEqual([]);
  await f.complete(jobId);
  const page = await f.owner.query(api.documents.references.issues, { documentId: f.documentId, paginationOpts });
  expect(page.status).toBe("ready");
  expect(page.page).toHaveLength(100);
  expect(page.isDone).toBe(false);
});
test("new snapshots hide old results immediately; superseded partial jobs cannot publish or delete current generation", async () => {
  const f = await fixture();
  const older = await f.save(80, 0);
  await f.t.mutation(internal.documents.references.step, { jobId: older });
  const latest = await f.save(1, 1);
  await f.complete(latest);
  await f.t.mutation(internal.documents.references.step, { jobId: older });
  await f.t.mutation(internal.documents.references.cleanup, { jobId: older });
  await f.t.mutation(internal.documents.references.cleanup, { jobId: latest });
  const page = await f.owner.query(api.documents.references.issues, { documentId: f.documentId, paginationOpts });
  expect(page.revision).toBe(2);
  expect(page.page).toHaveLength(1);
  const third = await f.save(0, 2);
  expect(
    (await f.owner.query(api.documents.references.issues, { documentId: f.documentId, paginationOpts })).status
  ).toBe("updating");
  await f.complete(third);
  expect(
    (await f.owner.query(api.documents.references.issues, { documentId: f.documentId, paginationOpts })).page
  ).toEqual([]);
});
test("reference reads reauthorize target lifecycle and source document independently", async () => {
  const f = await fixture();
  const job = await f.save(1, 0);
  await f.complete(job);
  await f.t.run((ctx) => ctx.db.patch(f.taskId, { deletedAt: Date.now() }));
  expect(
    (await f.owner.query(api.documents.references.issues, { documentId: f.documentId, paginationOpts })).page[0].task
  ).toBeNull();
  await f.t.run((ctx) => ctx.db.patch(f.documentId, { deleted: true }));
  await expect(
    f.owner.query(api.documents.references.issues, { documentId: f.documentId, paginationOpts })
  ).rejects.toThrow("not found");
  await f.t.run((ctx) => ctx.db.patch(f.documentId, { deleted: false }));
  expect(
    (await f.owner.query(api.documents.references.issues, { documentId: f.documentId, paginationOpts })).status
  ).toBe("ready");
});
test("canonical editor conversion retains token identity while duplicate transactions index once", () => {
  const binary = getBinaryDataFromDocumentEditorHTMLString(
    '<p><mention-component id="token" entity_name="user_mention" entity_identifier="member"></mention-component></p>',
    "Title"
  );
  const json = getAllDocumentFormatsFromDocumentEditorBinaryData(binary, true).contentJSON;
  expect(documentReferenceTokens(json)).toEqual([
    { transactionId: "token", entityName: "user_mention", entityIdentifier: "member" },
  ]);
  const node = { type: "mention", attrs: { id: "same", entity_name: "issue", entity_identifier: "task" } };
  expect(documentReferenceTokens({ type: "doc", content: [node, node] })).toHaveLength(1);
});

test("snapshot provenance is checked before publication and repeated backfill does not duplicate jobs", async () => {
  const f = await fixture();
  const jobId = await f.save(1, 0);
  const backfill = await f.t.mutation(internal.documents.references.backfill, { cursor: null });
  expect(backfill.scheduled).toBe(0);
  await f.t.run(async (ctx) => {
    const job = await ctx.db.get(jobId);
    await ctx.db.patch(job!.snapshotId, { revision: 99 });
  });
  await expect(f.t.mutation(internal.documents.references.step, { jobId })).rejects.toThrow("provenance");
  expect(
    (await f.owner.query(api.documents.references.issues, { documentId: f.documentId, paginationOpts })).status
  ).toBe("updating");
});
