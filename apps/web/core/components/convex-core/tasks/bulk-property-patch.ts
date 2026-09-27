import type { FunctionArgs } from "convex/server";
import type { api } from "@summon/convex/api";
import type { TaskPropertyValues } from "./task-properties";
export type BulkPropertyKey = "state" | "priority" | "assignees" | "labels" | "startDate" | "targetDate" | "estimate";
export function bulkPropertyPatch(values: TaskPropertyValues, enabled: BulkPropertyKey[]) {
  const patch: FunctionArgs<typeof api.tasks.bulk_properties.update>["updates"][number]["patch"] = {};
  if (enabled.includes("state") && values.status) {
    patch.status = values.status;
    patch.stateId = values.stateId;
  }
  if (enabled.includes("priority")) patch.priority = values.priority;
  if (enabled.includes("assignees")) patch.assigneeIds = values.assigneeIds;
  if (enabled.includes("labels")) patch.labelIds = values.labelIds;
  if (enabled.includes("startDate")) patch.startDate = values.startDate;
  if (enabled.includes("targetDate")) patch.targetDate = values.targetDate;
  if (enabled.includes("estimate")) patch.estimatePointId = values.estimatePointId;
  return patch;
}
