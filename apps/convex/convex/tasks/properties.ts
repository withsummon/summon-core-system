import { requireUsableLabel } from "./label_access";
import { validateEstimatePoint } from "../estimates/access";
import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { date } from "../commercial/validation";
import { taskProperties, nonStateTaskProperties } from "./schema";

export const MAX_TASK_ASSIGNEES = 100;
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
export async function validateNonStateProperties(
  ctx: QueryCtx,
  project: Doc<"projects">,
  data: Infer<typeof nonStateProperties>,
  retainedEstimatePointId?: Id<"estimatePoints"> | null
) {
  const estimatePointId = data.estimatePointId;
  await validateEstimatePoint(ctx, project._id, estimatePointId, retainedEstimatePointId);
  const startDate = date(data.startDate);
  const targetDate = date(data.targetDate);
  if (startDate && targetDate && startDate > targetDate) throw new ConvexError("Start date cannot exceed target date.");
  if (data.assigneeIds.length > MAX_TASK_ASSIGNEES || new Set(data.assigneeIds).size !== data.assigneeIds.length)
    throw new ConvexError(`Choose up to ${MAX_TASK_ASSIGNEES} distinct assignees.`);
  if (data.labelIds.length > 100 || new Set(data.labelIds).size !== data.labelIds.length)
    throw new ConvexError("Choose up to 100 distinct labels.");
  await Promise.all(
    data.assigneeIds.map(async (userId) => {
      const [member, workspaceMember] = await Promise.all([
        ctx.db
          .query("projectMembers")
          .withIndex("by_project_user", (q) => q.eq("projectId", project._id).eq("userId", userId))
          .unique(),
        ctx.db
          .query("workspaceMembers")
          .withIndex("by_workspace_user", (q) => q.eq("workspaceId", project.workspaceId).eq("userId", userId))
          .unique(),
      ]);
      if (!member?.active || member.role === "guest" || !workspaceMember?.active || workspaceMember.role === "guest")
        throw new ConvexError("Assignees must be active project writers.");
    })
  );
  await Promise.all(
    data.labelIds.map(async (labelId) => {
      const label = await requireUsableLabel(ctx, labelId);
      if (!label || label.projectId !== project._id) throw new ConvexError("Labels must belong to this project.");
    })
  );
  return {
    priority: data.priority,
    assigneeIds: data.assigneeIds,
    labelIds: data.labelIds,
    estimatePointId,
    startDate,
    targetDate,
  };
}
export async function validateProperties(
  ctx: QueryCtx,
  project: Doc<"projects">,
  data: Infer<typeof properties>,
  retainedEstimatePointId?: Id<"estimatePoints"> | null
) {
  const validated = await validateNonStateProperties(ctx, project, data, retainedEstimatePointId);
  const state = data.stateId ? await ctx.db.get(data.stateId) : null;
  if (data.stateId && (!state || state.projectId !== project._id))
    throw new ConvexError("State must belong to this project.");
  if (state?.status === "triage") throw new ConvexError("Use intake to manage triage tasks.");
  return { data: { ...validated, stateId: data.stateId }, state };
}

export function parseTaskText(rawTitle: string, description: string) {
  const title = rawTitle.trim();
  if (!title || title.length > 255 || description.length > 100000)
    throw new ConvexError("Enter a title up to 255 characters and a description up to 100,000 characters.");
  return { title, description };
}
