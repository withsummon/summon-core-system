import { convexToZod, zid, zodToConvex } from "convex-helpers/server/zod4";
import { z } from "zod/v4";
import { calendarDate } from "../commercial/validation";
import { defineTable } from "convex/server";
import { v } from "convex/values";
export const status = v.union(
  v.literal("backlog"),
  v.literal("todo"),
  v.literal("in_progress"),
  v.literal("done"),
  v.literal("cancelled")
);
export const taskStatus = v.union(...status.members, v.literal("triage"));
export const commentAudience = v.union(v.literal("INTERNAL"), v.literal("EXTERNAL"));
export const taskVote = v.union(v.literal(1), v.literal(-1));
export const commentRequestId = z.uuid();
export const commentCreation = v.object({
  requestId: zodToConvex(commentRequestId),
  htmlSha256: v.bytes(),
  audience: commentAudience,
  mentionedUserIds: v.array(v.id("users")),
  anchor: v.union(v.string(), v.null()),
});
export const priority = v.union(
  v.literal("urgent"),
  v.literal("high"),
  v.literal("medium"),
  v.literal("low"),
  v.literal("none")
);
const conditionFields = { id: z.string(), type: z.literal("condition") };
const dateProperty = z.enum(["startDate", "targetDate"]);
export const profileCondition = z.union([
  z.object({
    ...conditionFields,
    property: z.literal("priority"),
    operator: z.literal("exact"),
    value: convexToZod(priority),
  }),
  z.object({
    ...conditionFields,
    property: z.literal("priority"),
    operator: z.literal("in"),
    value: z.array(convexToZod(priority)).min(1),
  }),
  z.object({
    ...conditionFields,
    property: z.literal("status"),
    operator: z.literal("exact"),
    value: convexToZod(status),
  }),
  z.object({
    ...conditionFields,
    property: z.literal("status"),
    operator: z.literal("in"),
    value: z.array(convexToZod(status)).min(1),
  }),
  z.object({
    ...conditionFields,
    property: z.literal("labelId"),
    operator: z.literal("exact"),
    value: zid("taskLabels"),
  }),
  z.object({
    ...conditionFields,
    property: z.literal("labelId"),
    operator: z.literal("in"),
    value: z.array(zid("taskLabels")).min(1),
  }),
  z.object({ ...conditionFields, property: dateProperty, operator: z.literal("exact"), value: calendarDate }),
  z.object({
    ...conditionFields,
    property: dateProperty,
    operator: z.literal("range"),
    value: z.tuple([calendarDate, calendarDate]).refine(([from, to]) => from <= to, "Date range is reversed."),
  }),
]);
const filterGroup = z.object({ id: z.string(), type: z.literal("group"), logicalOperator: z.literal("and") });
// The inherited public filter API counts the root as depth one and permits five levels.
// Finite composition keeps every native validator and generated argument precise.
const filterDepth2 = z.union([profileCondition, filterGroup.extend({ children: z.array(profileCondition).min(1) })]);
const filterDepth3 = z.union([profileCondition, filterGroup.extend({ children: z.array(filterDepth2).min(1) })]);
const filterDepth4 = z.union([profileCondition, filterGroup.extend({ children: z.array(filterDepth3).min(1) })]);
export const profileExpression = z
  .union([profileCondition, filterGroup.extend({ children: z.array(filterDepth4).min(1) })])
  .nullable();
export const profileView = v.union(v.literal("assigned"), v.literal("created"), v.literal("subscribed"));
export const profileViewSchema = convexToZod(profileView);
export const profileGroup = v.union(
  v.null(),
  v.object({ by: v.literal("status"), value: status }),
  v.object({ by: v.literal("priority"), value: priority }),
  v.object({ by: v.literal("projectId"), value: v.id("projects") }),
  v.object({ by: v.literal("labelId"), value: v.union(v.id("taskLabels"), v.null()) })
);
export const profileOrder = v.union(
  v.literal("sortOrder"),
  v.literal("createdAt"),
  v.literal("updatedAt"),
  v.literal("startDate"),
  v.literal("priority")
);
export const profileGroupBy = v.union(
  ...profileGroup.members.filter((member) => member.kind === "object").map((member) => member.fields.by),
  v.null()
);
export const profileDisplayFilters = v.object({
  layout: v.union(v.literal("list"), v.literal("kanban")),
  groupBy: profileGroupBy,
  order: profileOrder,
  includeSubtasks: v.boolean(),
  showEmptyGroups: v.boolean(),
});
export const profileDisplayProperties = v.object({
  assignee: v.boolean(),
  attachment_count: v.boolean(),
  created_on: v.boolean(),
  due_date: v.boolean(),
  estimate: v.boolean(),
  key: v.boolean(),
  labels: v.boolean(),
  link: v.boolean(),
  priority: v.boolean(),
  start_date: v.boolean(),
  state: v.boolean(),
  sub_issue_count: v.boolean(),
  updated_on: v.boolean(),
  cycle: v.boolean(),
  modules: v.boolean(),
});
export const profileTaskPreferences = v.object({
  displayFilters: profileDisplayFilters,
  displayProperties: profileDisplayProperties,
  filters: zodToConvex(profileExpression),
});
export const profileTaskPreferencesSchema = convexToZod(profileTaskPreferences).extend({ filters: profileExpression });
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
export const taskPosition = v.object({
  previous: v.union(v.object({ taskId: v.id("tasks"), expectedUpdatedAt: v.number() }), v.null()),
  next: v.union(v.object({ taskId: v.id("tasks"), expectedUpdatedAt: v.number() }), v.null()),
});
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
const activityCycle = v.object({ id: v.id("cycles"), name: v.union(v.string(), v.null()) });
const activityModule = v.object({ id: v.id("modules"), name: v.string() });
export const taskLifecycleField = v.union(v.literal("archivedAt"), v.literal("deletedAt"));
export const taskEventKind = v.union(
  v.literal("created"),
  v.literal("status_changed"),
  v.literal("updated"),
  v.literal("archived"),
  v.literal("unarchived"),
  v.literal("deleted"),
  v.literal("restored"),
  v.literal("reaction_changed"),
  v.literal("vote_changed"),
  v.literal("comment_created"),
  v.literal("comment_updated"),
  v.literal("comment_deleted"),
  v.literal("comment_restored")
);
export const taskChange = v.union(
  v.object({ field: v.literal("vote"), before: v.union(taskVote, v.null()), after: v.union(taskVote, v.null()) }),
  v.object({ field: v.literal("title"), before: v.string(), after: v.string() }),
  v.object({ field: v.literal("priority"), before: priority, after: priority }),
  v.object({ field: v.literal("state"), before: activityState, after: activityState }),
  v.object({ field: v.literal("startDate"), before: taskProperties.startDate, after: taskProperties.startDate }),
  v.object({ field: v.literal("targetDate"), before: taskProperties.targetDate, after: taskProperties.targetDate }),
  v.object({ field: v.literal("assignees"), added: v.array(activityMember), removed: v.array(activityMember) }),
  v.object({ field: v.literal("labels"), added: v.array(activityLabel), removed: v.array(activityLabel) }),
  v.object({ field: v.literal("estimate"), before: activityEstimate, after: activityEstimate }),
  v.object({
    field: taskLifecycleField,
    before: v.union(v.number(), v.null()),
    after: v.union(v.number(), v.null()),
  }),
  v.object({
    field: v.literal("cycle"),
    before: v.union(activityCycle, v.null()),
    after: v.union(activityCycle, v.null()),
  }),
  v.object({ field: v.literal("modules"), added: v.array(activityModule), removed: v.array(activityModule) })
);
export const taskTables = {
  profileTaskPreferences: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    ...profileTaskPreferences.fields,
    revision: v.number(),
  }).index("by_owner", ["workspaceId", "userId"]),

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
  taskVotes: defineTable({
    taskId: v.id("tasks"),
    actorId: v.id("users"),
    vote: taskVote,
    deletedAt: v.union(v.number(), v.null()),
  })
    .index("by_task_actor_deleted", ["taskId", "actorId", "deletedAt"])
    .index("by_task_vote_deleted", ["taskId", "vote", "deletedAt"]),
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
    creation: v.optional(commentCreation),
    audience: commentAudience,
    mentionedUserIds: v.optional(v.array(v.id("users"))),
    taskId: v.id("tasks"),
    authorId: v.id("users"),
    html: v.string(),
    text: v.string(),
    updatedAt: v.number(),
    editedAt: v.union(v.number(), v.null()),
    deletedAt: v.optional(v.union(v.number(), v.null())),
  })
    .index("by_task", ["taskId"])
    .index("by_task_audience", ["taskId", "audience"])
    .index("by_author_task_creation_request", ["authorId", "taskId", "creation.requestId"]),
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
    sortOrder: v.number(),
    // Ascending value orders retain newest-task ties and place missing dates last.
    createdAtDescending: v.number(),
    startDateMissing: v.boolean(),
    priorityOrder: v.number(),
    createdBy: v.id("users"),
    updatedAt: v.number(),
    titleUpdatedAt: v.number(),
    upVoteCount: v.number(),
    downVoteCount: v.number(),
    ...taskProperties,
    completedAt: v.union(v.number(), v.null()),
  })
    .index("by_project", ["projectId"])
    .index("by_project_status", ["projectId", "status"])
    .index("by_project_sequence", ["projectId", "sequence"])
    .index("by_project_updated", ["projectId", "updatedAt"])
    .index("by_project_state_order", ["projectId", "stateId", "status", "deletedAt", "sortOrder"])
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_target", ["workspaceId", "targetDate"])
    .index("by_workspace_manual", ["workspaceId", "sortOrder", "createdAtDescending"])
    .index("by_workspace_start_date", ["workspaceId", "startDateMissing", "startDate", "createdAtDescending"])
    .index("by_workspace_priority", ["workspaceId", "priorityOrder", "createdAtDescending"])
    .index("by_workspace_updated", ["workspaceId", "updatedAt"])
    .index("by_state", ["stateId"]),
  taskEvents: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.id("projects"),
    taskId: v.id("tasks"),
    actorId: v.id("users"),
    commentId: v.optional(v.id("taskComments")),
    changes: v.optional(v.array(taskChange)),
    kind: taskEventKind,
    status: taskStatus,
  })
    .index("by_task", ["taskId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_actor", ["workspaceId", "actorId"]),
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
