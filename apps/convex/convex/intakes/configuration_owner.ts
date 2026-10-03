import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
export async function ensureDefaultIntake(ctx: MutationCtx, project: Doc<"projects">) {
  const existing = await ctx.db
    .query("intakes")
    .withIndex("by_project", (q) => q.eq("projectId", project._id))
    .unique();
  if (!existing)
    await ctx.db.insert("intakes", {
      projectId: project._id,
      name: `${project.name} Intake`,
      description: "",
      isDefault: true,
      updatedAt: Date.now(),
    });
}
