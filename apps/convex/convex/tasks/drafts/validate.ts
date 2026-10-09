import { ConvexError, v } from "convex/values";
import type { Infer } from "convex/values";
import type { MutationCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { requireProject } from "../../identity/access";
import { validateProperties } from "../properties";
import { requireParent } from "../hierarchy";
import { requireCycle, requireCycleRevision, requireOpenCycle } from "../../cycles/access";
import { requireModule, requireModuleRevision, requireEditableModule } from "../../modules/access";
import { date } from "../../commercial/validation";
import { draftFields, validateModuleReferences } from "./fields";
const fields = v.object(draftFields);
export async function validateDraft(ctx: MutationCtx, workspaceId: Id<"workspaces">, args: Infer<typeof fields>) {
  if (args.title.length > 255) throw new ConvexError("Draft title must be at most 255 characters.");
  validateModuleReferences(args.modules);
  if (!args.projectId) {
    if (
      args.parent ||
      args.cycle ||
      args.modules.length ||
      args.properties.stateId ||
      args.properties.estimatePointId ||
      args.properties.labelIds.length ||
      args.properties.assigneeIds.length
    )
      throw new ConvexError("Choose a project before assigning project properties.");
    const start = date(args.properties.startDate),
      end = date(args.properties.targetDate);
    if (start && end && start > end) throw new ConvexError("Start date cannot exceed target date.");
    return;
  }
  const { project } = await requireProject(ctx, args.projectId);
  if (project.workspaceId !== workspaceId) throw new ConvexError("Project belongs to another workspace.");
  const { state } = await validateProperties(ctx, project, args.properties);
  if (state && args.status && state.status !== args.status)
    throw new ConvexError("Task status must match its custom state.");
  if (args.parent) await requireParent(ctx, project._id, args.parent.taskId, args.parent.expectedUpdatedAt);
  if (args.cycle) {
    const { cycle } = await requireCycle(ctx, args.cycle.cycleId);
    if (cycle.projectId !== project._id) throw new ConvexError("Cycle belongs to another project.");
    requireOpenCycle(cycle);
    requireCycleRevision(cycle, args.cycle.expectedCycleUpdatedAt);
  }
  await Promise.all(
    args.modules.map(async (ref) => {
      const { module } = await requireModule(ctx, ref.moduleId);
      if (module.projectId !== project._id) throw new ConvexError("Module belongs to another project.");
      requireEditableModule(module);
      requireModuleRevision(module, ref.expectedModuleUpdatedAt);
    })
  );
}
