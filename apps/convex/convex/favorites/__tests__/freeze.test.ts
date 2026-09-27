import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
test("migration freeze denies both old favorite writers after normal authorization and preserves source flags", async () => {
  const f = await workspaceJourney();
  const ids = await f.t.run(async (ctx) => {
    const fields = {
      workspaceId: f.workspaceId,
      ownerId: f.userId,
      name: "View",
      description: "",
      filters: {
        match: "all" as const,
        statuses: [],
        stateIds: [],
        priorities: [],
        assigneeIds: [],
        labelIds: [],
        creatorIds: [],
        startDate: null,
        targetDate: null,
      },
      isLocked: false,
      updatedAt: Date.now(),
      deletedAt: null,
    };
    const project = await ctx.db.insert("savedViews", { ...fields, projectId: f.projectId });
    const workspace = await ctx.db.insert("savedViews", { ...fields, projectId: null });
    await ctx.db.insert("savedViewFavorites", {
      workspaceId: f.workspaceId,
      projectId: f.projectId,
      viewId: project,
      userId: f.userId,
    });
    return { project, workspace };
  });
  await expect(
    f.owner.mutation(api.savedViews.favorites.set, { viewId: ids.project, favorite: false })
  ).rejects.toThrow("migration is in progress");
  await expect(
    f.owner.mutation(api.savedViews.workspace.favorite, { viewId: ids.workspace, favorite: true })
  ).rejects.toThrow("migration is in progress");
  await expect(f.t.mutation(api.savedViews.favorites.set, { viewId: ids.project, favorite: true })).rejects.toThrow(
    "Sign in"
  );
  expect(await f.t.run((ctx) => ctx.db.query("savedViewFavorites").collect())).toHaveLength(1);
});
