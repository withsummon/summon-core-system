import { defineTable } from "convex/server";
import { v } from "convex/values";
export const status = v.union(
  v.literal("backlog"),
  v.literal("todo"),
  v.literal("in_progress"),
  v.literal("done"),
  v.literal("cancelled")
);
export const taskStatus = v.union(status, v.literal("triage"));
export const priority = v.union(
  v.literal("urgent"),
  v.literal("high"),
  v.literal("medium"),
  v.literal("low"),
  v.literal("none")
);
export const nonStateTaskProperties = {
  estimatePointId: v.union(v.id("estimatePoints"), v.null()),
  priority,
  assigneeIds: v.array(v.id("users")),
  labelIds: v.array(v.id("taskLabels")),
  startDate: v.union(v.string(), v.null()),
  targetDate: v.union(v.string(), v.null()),
};
export const taskProperties = {
  ...nonStateTaskProperties,
  stateId: v.union(v.id("taskStates"), v.null()),
};
export const stateFields = {
  name: v.string(),
  description: v.string(),
  color: v.string(),
  status,
  sortOrder: v.number(),
  isDefault: v.boolean(),
};
export const labelFields = { name: v.string(), description: v.string(), color: v.string(), sortOrder: v.number() };
export const relationKind = v.union(
  v.literal("blocks"),
  v.literal("relates_to"),
  v.literal("duplicate"),
  v.literal("start_before"),
  v.literal("finish_before"),
  v.literal("implemented_by")
);
const activityMember = v.object({ id: v.id("users"), name: v.union(v.string(), v.null()) });
const activityLabel = v.object({ id: v.id("taskLabels"), name: v.union(v.string(), v.null()) });
const activityState = v.object({
  status: taskStatus,
  id: v.union(v.id("taskStates"), v.null()),
  name: v.union(v.string(), v.null()),
});
const activityEstimate = v.union(
  v.null(),
  v.object({ id: v.id("estimatePoints"), value: v.union(v.string(), v.null()) })
);
export const taskChange = v.union(
  v.object({ field: v.literal("title"), before: v.string(), after: v.string() }),
  v.object({ field: v.literal("priority"), before: priority, after: priority }),
  v.object({ field: v.literal("state"), before: activityState, after: activityState }),
  v.object({ field: v.literal("startDate"), before: taskProperties.startDate, after: taskProperties.startDate }),
  v.object({ field: v.literal("targetDate"), before: taskProperties.targetDate, after: taskProperties.targetDate }),
  v.object({ field: v.literal("assignees"), added: v.array(activityMember), removed: v.array(activityMember) }),
  v.object({ field: v.literal("labels"), added: v.array(activityLabel), removed: v.array(activityLabel) }),
  v.object({ field: v.literal("estimate"), before: activityEstimate, after: activityEstimate })
);
export const taskTables = {
  taskCommentReactions: defineTable({
    commentId: v.id("taskComments"),
    actorId: v.id("users"),
    reaction: v.string(),
    deletedAt: v.union(v.number(), v.null()),
  })
    .index("by_comment_deleted", ["commentId", "deletedAt"])
    .index("by_comment_actor_code_deleted", ["commentId", "actorId", "reaction", "deletedAt"]),
  taskReactions: defineTable({
    taskId: v.id("tasks"),
    actorId: v.id("users"),
    reaction: v.string(),
    deletedAt: v.union(v.number(), v.null()),
  })
    .index("by_task_deleted", ["taskId", "deletedAt"])
    .index("by_task_actor_code_deleted", ["taskId", "actorId", "reaction", "deletedAt"]),
  taskLinks: defineTable({
    taskId: v.id("tasks"),
    url: v.string(),
    title: v.union(v.string(), v.null()),
    metadata: v.any(),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
    updatedAt: v.number(),
    deletedAt: v.union(v.number(), v.null()),
  })
    .index("by_task_deleted", ["taskId", "deletedAt"])
    .index("by_task_url_deleted", ["taskId", "url", "deletedAt"]),
  taskComments: defineTable({
    mentionedUserIds: v.optional(v.array(v.id("users"))),
    taskId: v.id("tasks"),
    authorId: v.id("users"),
    html: v.string(),
    text: v.string(),
    updatedAt: v.number(),
    editedAt: v.union(v.number(), v.null()),
    deletedAt: v.optional(v.union(v.number(), v.null())),
  }).index("by_task", ["taskId"]),
  taskDescriptionVersions: defineTable({
    taskId: v.id("tasks"),
    actorId: v.id("users"),
    html: v.string(),
    description: v.string(),
    lastSavedAt: v.number(),
    revision: v.number(),
  }).index("by_task", ["taskId"]),
  taskDescriptions: defineTable({
    taskId: v.id("tasks"),
    html: v.string(),
    descriptionJson: v.optional(v.any()),
    descriptionBinary: v.optional(v.bytes()),
  }).index("by_task", ["taskId"]),
  taskParents: defineTable({ projectId: v.id("projects"), childId: v.id("tasks"), parentId: v.id("tasks") })
    .index("by_child", ["childId"])
    .index("by_parent", ["parentId"]),
  taskRelations: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.id("projects"),
    fromId: v.id("tasks"),
    toId: v.id("tasks"),
    kind: relationKind,
  })
    .index("by_from", ["fromId"])
    .index("by_to", ["toId"])
    .index("by_project", ["projectId"])
    .index("by_pair", ["fromId", "toId"])
    .index("by_workspace_kind", ["workspaceId", "kind"]),
  tasks: defineTable({
    archivedAt: v.union(v.number(), v.null()),
    deletedAt: v.union(v.number(), v.null()),
    workspaceId: v.id("workspaces"),
    projectId: v.id("projects"),
    title: v.string(),
    description: v.string(),
    status: taskStatus,
    sequence: v.number(),
    createdBy: v.id("users"),
    updatedAt: v.number(),
    ...taskProperties,
    completedAt: v.union(v.number(), v.null()),
  })
    .index("by_project", ["projectId"])
    .index("by_project_status", ["projectId", "status"])
    .index("by_project_sequence", ["projectId", "sequence"])
    .index("by_workspace", ["workspaceId"])
    .index("by_state", ["stateId"]),
  taskEvents: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.id("projects"),
    taskId: v.id("tasks"),
    actorId: v.id("users"),
    commentId: v.optional(v.id("taskComments")),
    changes: v.optional(v.array(taskChange)),
    kind: v.union(
      v.literal("created"),
      v.literal("status_changed"),
      v.literal("updated"),
      v.literal("comment_created"),
      v.literal("comment_updated"),
      v.literal("comment_deleted"),
      v.literal("comment_restored")
    ),
    status: taskStatus,
  }).index("by_task", ["taskId"]),
  taskStates: defineTable({
    ...stateFields,
    status: taskStatus,
    workspaceId: v.id("workspaces"),
    projectId: v.id("projects"),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_project_name", ["projectId", "name"])
    .index("by_project_order", ["projectId", "sortOrder"])
    .index("by_project_default", ["projectId", "isDefault"]),
  labelRemovalJobs: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.id("projects"),
    labelIds: v.array(v.id("taskLabels")),
    name: v.string(),
    phase: v.union(v.literal("tasks"), v.literal("drafts"), v.literal("documents"), v.literal("views")),
    documentLabelIndex: v.number(),
    cursor: v.union(v.string(), v.null()),
    changed: v.number(),
    started: v.boolean(),
    status: v.union(v.literal("running"), v.literal("completed"), v.literal("cancelled")),
  }).index("by_project", ["projectId"]),
  taskLabels: defineTable({
    ...labelFields,
    workspaceId: v.id("workspaces"),
    projectId: v.id("projects"),
    parentId: v.union(v.id("taskLabels"), v.null()),
    revision: v.number(),
    retiring: v.boolean(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_project_name", ["projectId", "name"])
    .index("by_project_order", ["projectId", "sortOrder"]),
};
