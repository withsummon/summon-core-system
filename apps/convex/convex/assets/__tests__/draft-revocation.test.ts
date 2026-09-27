import { createHash } from "node:crypto";
import { expect, test } from "vitest";
import { api, internal } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";

async function fixture() {
  const f = await workspaceJourney();
  const draftId = await f.owner.mutation(api.tasks.drafts.index.create, { workspaceId: f.workspaceId });
  const text = "Private bytes";
  const intent = await f.owner.mutation(api.assets.draftAttachments.prepare, {
    draftId,
    name: "file.txt",
    contentType: "text/plain",
    size: text.length,
    sha256: createHash("sha256").update(text).digest("base64"),
  });
  const storageId = await f.t.run((ctx) => ctx.storage.store(new Blob([text], { type: "text/plain" })));
  const revoke = () =>
    f.t.run(async (ctx) => {
      const member = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace_user", (q) => q.eq("workspaceId", f.workspaceId).eq("userId", f.userId))
        .unique();
      if (!member) throw new Error("Fixture membership missing");
      await ctx.db.patch(member._id, { active: false });
    });
  return { ...f, draftId, assetId: intent.assetId, storageId, revoke, text };
}
test("membership revoked after upload claim prevents commit without exposing or finalizing private bytes", async () => {
  const f = await fixture();
  await f.owner.mutation(internal.assets.index.claim, { assetId: f.assetId, storageId: f.storageId });
  await f.revoke();
  await expect(f.owner.mutation(internal.assets.index.commit, { assetId: f.assetId })).rejects.toThrow("workspace");
  expect((await f.t.run((ctx) => ctx.db.get(f.assetId)))?.status).toBe("pending");
  await expect(f.owner.query(api.assets.index.get, { assetId: f.assetId })).rejects.toThrow();
});
test("membership revoked after copy snapshot prevents atomic destination creation and leaves source bytes owned", async () => {
  const f = await fixture();
  await f.owner.action(api.assets.upload.finalize, { assetId: f.assetId, storageId: f.storageId });
  const draft = await f.owner.query(api.tasks.drafts.index.resolve, { workspaceId: f.workspaceId, draftId: f.draftId });
  await f.owner.query(internal.tasks.drafts.copy.snapshot, { draftId: f.draftId, expectedUpdatedAt: draft.updatedAt });
  const copiedStorageId = await f.t.run((ctx) => ctx.storage.store(new Blob([f.text], { type: "text/plain" })));
  await f.revoke();
  await expect(
    f.owner.mutation(internal.tasks.drafts.copy.commit, {
      draftId: f.draftId,
      expectedUpdatedAt: draft.updatedAt,
      files: [{ sourceId: f.assetId, revision: 0, storageId: copiedStorageId }],
    })
  ).rejects.toThrow("workspace");
  const state = await f.t.run(async (ctx) => ({
    drafts: await ctx.db.query("taskDrafts").collect(),
    assets: await ctx.db.query("assets").collect(),
    source: !!(await ctx.storage.get(f.storageId)),
  }));
  expect(state.drafts).toHaveLength(1);
  expect(state.assets).toHaveLength(1);
  expect(state.assets[0].storageId).toBe(f.storageId);
  expect(state.source).toBe(true);
});
