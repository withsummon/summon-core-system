import type { FunctionReturnType } from "convex/server";
import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { signedIn } from "../../../test-support/session";
test("member counts traverse sparse pages without inventing totals and reauthorize each read", async () => {
  const f = await workspaceJourney();
  const ids = await f.t.run(async (ctx) => {
    const created = [];
    for (let i = 0; i < 4; i++) {
      // oxlint-disable-next-line no-await-in-loop
      const userId = await ctx.db.insert("users", { name: `Member ${i}` });
      created.push(userId);
      // oxlint-disable-next-line no-await-in-loop
      await ctx.db.insert("workspaceMembers", {
        workspaceId: f.workspaceId,
        userId,
        role: "member",
        active: i % 2 === 0,
      });
    }
    return created;
  });
  let cursor: string | null = null,
    count = 0,
    pages = 0;
  do {
    // oxlint-disable-next-line no-await-in-loop
    const result: FunctionReturnType<typeof api.workspaces.member_count.page> = await f.owner.query(
      api.workspaces.member_count.page,
      {
        workspaceId: f.workspaceId,
        paginationOpts: { cursor, numItems: 1 },
      }
    );
    count += result.page[0].activeMembers;
    pages++;
    cursor = result.isDone ? null : result.continueCursor;
  } while (cursor);
  expect(count).toBe(3);
  expect(pages).toBe(5);
  const revoked = await signedIn(f.t, ids[1]);
  await expect(
    revoked.query(api.workspaces.member_count.page, {
      workspaceId: f.workspaceId,
      paginationOpts: { cursor: null, numItems: 10 },
    })
  ).rejects.toThrow();
  await expect(
    f.t.query(api.workspaces.member_count.page, {
      workspaceId: f.workspaceId,
      paginationOpts: { cursor: null, numItems: 10 },
    })
  ).rejects.toThrow();
});
