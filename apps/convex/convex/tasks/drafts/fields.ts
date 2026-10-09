import { ConvexError, v } from "convex/values";
import type { Infer } from "convex/values";
import { status, taskProperties } from "../schema";
export const draftFields = {
  projectId: v.union(v.id("projects"), v.null()),
  title: v.string(),
  html: v.string(),
  status: v.union(status, v.null()),
  properties: v.object(taskProperties),
  parent: v.union(v.object({ taskId: v.id("tasks"), expectedUpdatedAt: v.number() }), v.null()),
  cycle: v.union(v.object({ cycleId: v.id("cycles"), expectedCycleUpdatedAt: v.number() }), v.null()),
  modules: v.array(v.object({ moduleId: v.id("modules"), expectedModuleUpdatedAt: v.number() })),
};

export function validateModuleReferences(modules: Infer<typeof draftFields.modules>) {
  if (modules.length > 100 || new Set(modules.map((item) => item.moduleId)).size !== modules.length)
    throw new ConvexError("Choose at most 100 distinct modules.");
}
