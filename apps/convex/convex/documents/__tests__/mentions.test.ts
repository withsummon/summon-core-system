import type { FunctionReturnType } from "convex/server";
import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { signedIn } from "../../../test-support/session";
async function fixture() {
  const f = await workspaceJourney();
  const documentId = await f.owner.mutation(api.documents.index.create, {
    workspaceId: f.workspaceId,
    name: "Mentions",
    access: "private",
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
  const memberId = await f.t.run(async (ctx) => {
    const id = await ctx.db.insert("users", { name: "Reader", email: "reader@example.test" });
    await ctx.db.insert("workspaceMembers", { workspaceId: f.workspaceId, userId: id, role: "member", active: true });
    return id;
  });
  return { ...f, documentId, memberId, member: await signedIn(f.t, memberId) };
}
test("private document authorization precedes member directory lookup; sharing does not change from mentioning", async () => {
  const f = await fixture();
  const result = await f.owner.query(api.documents.mentions.resolve, {
    documentId: f.documentId,
    userIds: [f.memberId],
  });
  expect(result[0].member?.name).toBe("Reader");
  await expect(
    f.member.query(api.documents.mentions.resolve, { documentId: f.documentId, userIds: [f.userId] })
  ).rejects.toThrow("access denied");
  await expect(
    f.member.query(api.documents.mentions.search, {
      documentId: f.documentId,
      search: "",
      paginationOpts: { cursor: null, numItems: 10 },
    })
  ).rejects.toThrow("access denied");
});
test("inactive, foreign, and malformed user tokens resolve unavailable without leaking labels", async () => {
  const f = await fixture();
  const foreign = await f.t.run(async (ctx) => {
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", f.workspaceId).eq("userId", f.memberId))
      .unique();
    await ctx.db.patch(membership!._id, { active: false });
    return ctx.db.insert("users", { name: "Secret foreign member" });
  });
  const ids = [f.memberId, foreign, "not-an-id"];
  expect(await f.owner.query(api.documents.mentions.resolve, { documentId: f.documentId, userIds: ids })).toEqual(
    ids.map((id) => ({ id, member: null }))
  );
  await expect(
    f.owner.query(api.documents.mentions.resolve, { documentId: f.documentId, userIds: Array(101).fill(f.userId) })
  ).rejects.toThrow("100");
});
test("search preserves sparse continuation and reads locked archived document without changing tokens", async () => {
  const f = await fixture();
  await f.t.run((ctx) => ctx.db.patch(f.documentId, { isLocked: true, archived: true }));
  let cursor: string | null = null;
  let found = false;
  do {
    // Each cursor is produced by the previous bounded page.
    // oxlint-disable-next-line no-await-in-loop
    const page: FunctionReturnType<typeof api.documents.mentions.search> = await f.owner.query(
      api.documents.mentions.search,
      {
        documentId: f.documentId,
        search: "reader@example",
        paginationOpts: { cursor, numItems: 1 },
      }
    );
    found ||= page.page.some((row) => row.id === f.memberId);
    cursor = page.isDone ? null : page.continueCursor;
  } while (cursor);
  expect(found).toBe(true);
  const document = await f.owner.query(api.documents.index.get, { documentId: f.documentId });
  expect(document.revision).toBe(0);
});
