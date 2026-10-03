import { defineTable } from "convex/server";
import { v, type Infer } from "convex/values";
import { viewFilters } from "../savedViews/schema";
export const intakeStatus = v.union(
  v.literal("pending"),
  v.literal("rejected"),
  v.literal("snoozed"),
  v.literal("accepted"),
  v.literal("duplicate")
);
export const intakeView = v.union(...intakeStatus.members, v.literal("open"), v.literal("closed"));
export const intakeSelection = v.object({
  statuses: v.array(intakeStatus),
  priorities: viewFilters.fields.priorities,
  creatorIds: viewFilters.fields.creatorIds,
  assigneeIds: viewFilters.fields.assigneeIds,
  labelIds: viewFilters.fields.labelIds,
  createdAt: viewFilters.fields.startDate,
  updatedAt: viewFilters.fields.targetDate,
  order: v.union(v.literal("createdAt"), v.literal("updatedAt"), v.literal("sequence")),
  direction: v.union(v.literal("asc"), v.literal("desc")),
});
export const defaultIntakeSelection = {
  statuses: [],
  priorities: [],
  creatorIds: [],
  assigneeIds: [],
  labelIds: [],
  createdAt: null,
  updatedAt: null,
  order: "createdAt",
  direction: "desc",
} satisfies Infer<typeof intakeSelection>;
export function intakeDefaults(view: Infer<typeof intakeView>) {
  return {
    ...defaultIntakeSelection,
    statuses: view === "open" ? ["pending"] : view === "closed" ? ["accepted", "rejected", "duplicate"] : [view],
  } satisfies Infer<typeof intakeSelection>;
}
export const intakeTables = {
  intakes: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    description: v.string(),
    isDefault: v.boolean(),
    updatedAt: v.number(),
  }).index("by_project", ["projectId"]),
  intakeTasks: defineTable({
    projectId: v.id("projects"),
    intakeId: v.id("intakes"),
    taskId: v.id("tasks"),
    status: intakeStatus,
    snoozedUntil: v.union(v.number(), v.null()),
    duplicateTo: v.union(v.id("tasks"), v.null()),
    source: v.literal("IN_APP"),
    createdBy: v.id("users"),
    updatedAt: v.number(),
    deletedAt: v.union(v.number(), v.null()),
    // Pre-recovery rows have no trustworthy task-deletion receipt. Never infer one.
    removalTaskRevision: v.optional(v.union(v.number(), v.null())),
  })
    .index("by_task", ["taskId"])
    .index("by_project_status", ["projectId", "status"])
    .index("by_project", ["projectId"]),
};
