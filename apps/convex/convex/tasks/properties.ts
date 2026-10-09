import { taskStateDeletedAt, taskStateIsTriage } from "./schema";
import { requireUsableLabel } from "./label_access";
import { validateEstimatePoint } from "../estimates/access";
import { ConvexError, v, type Infer } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import { accountRestricted } from "../identity/deactivation/access";
import type { Doc, Id } from "../_generated/dataModel";
import { date } from "../commercial/validation";
import { taskProperties, nonStateTaskProperties } from "./schema";

export const initialProperties = {
  priority: "none",
  estimatePointId: null,
  assigneeIds: [],
  labelIds: [],
  startDate: null,
  targetDate: null,
  stateId: null,
  completedAt: null,
} satisfies Infer<typeof properties> & { completedAt: null };
const properties = v.object(taskProperties);
const nonStateProperties = v.object(nonStateTaskProperties);
export async function taskAssigneeEligible(ctx: QueryCtx, project: Doc<"projects">, userId: Id<"users">) {
  const [member, workspaceMember, user, restricted] = await Promise.all([
    ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", project._id).eq("userId", userId))
      .unique(),
    ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", project.workspaceId).eq("userId", userId))
      .unique(),
    ctx.db.get(userId),
    accountRestricted(ctx, userId),
  ]);
  return (
    member?.active === true &&
    member.role !== "guest" &&
    workspaceMember?.active === true &&
    workspaceMember.role !== "guest" &&
    user !== null &&
    !restricted
  );
}
export async function creationAssignees(
  ctx: QueryCtx,
  project: Doc<"projects">,
  assigneeIds: Infer<typeof properties>["assigneeIds"]
) {
  if (assigneeIds.length || project.defaultAssigneeId === null) return assigneeIds;
  return (await taskAssigneeEligible(ctx, project, project.defaultAssigneeId)) ? [project.defaultAssigneeId] : [];
}
export async function validateNonStateProperties(
  ctx: QueryCtx,
  project: Doc<"projects">,
  data: Infer<typeof nonStateProperties>,
  retainedTask?: Doc<"tasks">
) {
  await validateEstimatePoint(ctx, project._id, data.estimatePointId, retainedTask?.estimatePointId);
  const startDate = date(data.startDate);
  const targetDate = date(data.targetDate);
  if (
    startDate &&
    targetDate &&
    startDate > targetDate &&
    (startDate !== retainedTask?.startDate || targetDate !== retainedTask?.targetDate)
  )
    throw new ConvexError("Start date cannot exceed target date.");
  if (new Set(data.assigneeIds).size !== data.assigneeIds.length) throw new ConvexError("Choose distinct assignees.");
  if (new Set(data.labelIds).size !== data.labelIds.length) throw new ConvexError("Choose distinct labels.");
  await Promise.all(
    data.assigneeIds
      .filter((id) => !retainedTask?.assigneeIds.includes(id))
      .map(async (userId) => {
        if (!(await taskAssigneeEligible(ctx, project, userId)))
          throw new ConvexError("Assignees must be active project writers.");
      })
  );
  await Promise.all(
    data.labelIds
      .filter((id) => !retainedTask?.labelIds.includes(id))
      .map(async (labelId) => {
        const label = await requireUsableLabel(ctx, labelId);
        if (label.projectId !== project._id) throw new ConvexError("Labels must belong to this project.");
      })
  );
  return {
    priority: data.priority,
    assigneeIds: data.assigneeIds,
    labelIds: data.labelIds,
    estimatePointId: data.estimatePointId,
    startDate,
    targetDate,
  };
}
export async function validateProperties(
  ctx: QueryCtx,
  project: Doc<"projects">,
  data: Infer<typeof properties>,
  retainedTask?: Doc<"tasks">
) {
  const validated = await validateNonStateProperties(ctx, project, data, retainedTask);
  const state = data.stateId ? await ctx.db.get(data.stateId) : null;
  if (data.stateId && (!state || state.projectId !== project._id))
    throw new ConvexError("State must belong to this project.");
  if (
    state &&
    (((taskStateDeletedAt(state.deletedAt) !== null || taskStateIsTriage(state.isTriage)) &&
      data.stateId !== retainedTask?.stateId) ||
      state.status === "triage")
  )
    throw new ConvexError("Use intake to manage triage tasks.");
  return { data: { ...validated, stateId: data.stateId }, state: state ? { ...state, status: state.status } : null };
}

export function parseTaskText(rawTitle: string, description: string) {
  const title = rawTitle.trim();
  if (!title || title.length > 255 || description.length > 100000)
    throw new ConvexError("Enter a title up to 255 characters and a description up to 100,000 characters.");
  return { title, description };
}
