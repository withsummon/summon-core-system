import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { apiIdSchema } from "../identity/schema";
import { convexToZod, zid, zodToConvex } from "convex-helpers/server/zod4";
import { z } from "zod/v4";
import { calendarDate } from "../commercial/validation";
import { defineTable } from "convex/server";
import { ConvexError, v, type Infer } from "convex/values";
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
const dateRange = v.union(
  v.object({ from: v.union(v.string(), v.null()), to: v.union(v.string(), v.null()) }),
  v.null()
);
export const viewFilters = v.object({
  match: v.union(v.literal("all"), v.literal("any")),
  statuses: v.array(status),
  stateIds: v.array(v.id("taskStates")),
  priorities: v.array(priority),
  assigneeIds: v.array(v.id("users")),
  labelIds: v.array(v.id("taskLabels")),
  creatorIds: v.array(v.id("users")),
  cycleIds: v.optional(v.array(v.id("cycles"))),
  moduleIds: v.optional(v.array(v.id("modules"))),
  startDate: dateRange,
  targetDate: dateRange,
});

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
// Collection display preferences are independent of the profile's two-layout renderer.
export const taskLayout = v.union(
  v.literal("list"),
  v.literal("kanban"),
  v.literal("calendar"),
  v.literal("spreadsheet"),
  v.literal("gantt_chart")
);
export const taskOrder = v.union(...profileOrder.members, v.literal("targetDate"));
export const taskGroupBy = v.union(
  v.literal("stateId"),
  v.literal("priority"),
  v.literal("cycleId"),
  v.literal("moduleId"),
  v.literal("labelId"),
  v.literal("assigneeId"),
  v.literal("createdBy"),
  v.null()
);
export const taskDisplayProperties = v.object({ ...profileDisplayProperties.fields, issue_type: v.boolean() });
export const taskDisplayPropertiesSchema = convexToZod(taskDisplayProperties);
export const taskDisplayFilters = v.object({
  ...profileDisplayFilters.fields,
  layout: taskLayout,
  groupBy: taskGroupBy,
  subGroupBy: taskGroupBy,
  order: taskOrder,
  calendar: v.object({ showWeekends: v.boolean(), layout: v.union(v.literal("month"), v.literal("week")) }),
});
export const taskDisplayFiltersSchema = convexToZod(taskDisplayFilters).superRefine((displayFilters, ctx) => {
  if (displayFilters.groupBy === null && displayFilters.subGroupBy !== null)
    ctx.addIssue({ code: "custom", message: "Choose a primary group before a subgroup." });
  if (displayFilters.layout === "kanban" && displayFilters.groupBy === null)
    ctx.addIssue({ code: "custom", message: "Choose a group for the board layout." });
  if (displayFilters.subGroupBy !== null && displayFilters.groupBy === displayFilters.subGroupBy)
    ctx.addIssue({ code: "custom", message: "Choose distinct primary and secondary groups." });
});
export const taskPreferences = v.object({
  displayFilters: taskDisplayFilters,
  displayProperties: taskDisplayProperties,
  filters: viewFilters,
});
export const taskPreferencesSchema = convexToZod(taskPreferences).extend({ displayFilters: taskDisplayFiltersSchema });
export const defaultTaskPreferences = {
  displayFilters: {
    layout: "list",
    groupBy: null,
    subGroupBy: null,
    order: "createdAt",
    includeSubtasks: true,
    showEmptyGroups: true,
    calendar: { showWeekends: false, layout: "month" },
  },
  displayProperties: {
    assignee: true,
    attachment_count: true,
    created_on: true,
    due_date: true,
    estimate: true,
    key: true,
    labels: true,
    link: true,
    priority: true,
    start_date: true,
    state: true,
    sub_issue_count: true,
    updated_on: true,
    cycle: true,
    modules: true,
    issue_type: true,
  },
  filters: {
    match: "all",
    statuses: [],
    stateIds: [],
    priorities: [],
    assigneeIds: [],
    labelIds: [],
    creatorIds: [],
    startDate: null,
    targetDate: null,
  },
} satisfies Infer<typeof taskPreferences>;

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
// Optional only until every historical catalogue row has evidence-based adoption.
export const stateTriage = v.optional(v.boolean());
export const stateRetirement = v.optional(v.union(v.number(), v.null()));
export function taskStateDeletedAt(value: Infer<typeof stateRetirement>) {
  if (value === undefined)
    throw new ConvexError({ status: 503, detail: "This state's retirement history has not been adopted." });
  return value;
}
export function taskStateIsTriage(value: Infer<typeof stateTriage>) {
  if (value === undefined)
    throw new ConvexError({ status: 503, detail: "This state's triage classification has not been adopted." });
  return value;
}
export function taskStateIsSelectable(
  state: Pick<Doc<"taskStates">, "deletedAt" | "isTriage" | "status">
): state is Pick<Doc<"taskStates">, "deletedAt" | "isTriage" | "status"> & {
  status: Infer<typeof status>;
  deletedAt: null;
  isTriage: false;
} {
  return (
    taskStateDeletedAt(state.deletedAt) === null && !taskStateIsTriage(state.isTriage) && state.status !== "triage"
  );
}
export const catalogueHistoryFields = {
  createdBy: v.optional(v.union(v.id("users"), v.null())),
  updatedBy: v.optional(v.union(v.id("users"), v.null())),
  updatedAt: v.optional(v.number()),
  externalSource: v.optional(v.union(v.string(), v.null())),
  externalId: v.optional(v.union(v.string(), v.null())),
};
export const stateApiGroup = z.enum(["backlog", "unstarted", "started", "completed", "cancelled", "triage"]);
export const stateApiNativeGroup = {
  backlog: "backlog",
  unstarted: "todo",
  started: "in_progress",
  completed: "done",
  cancelled: "cancelled",
  triage: "triage",
} satisfies Record<z.infer<typeof stateApiGroup>, Infer<typeof taskStatus>>;
export function stateApiGroupFromStatus(value: Infer<typeof taskStatus>) {
  const group = stateApiGroup.options.find((entry) => stateApiNativeGroup[entry] === value);
  if (group === undefined) throw new Error("State group is absent from its canonical external enumeration.");
  return group;
}
// DRF's REST fields accept these representations; native UI schemas remain strict.
const catalogueApiString = z.preprocess(
  (value) => (typeof value === "number" ? String(value) : value),
  z
    .string({
      error: (issue) =>
        issue.input === undefined
          ? "This field is required."
          : issue.input === null
            ? "This field may not be null."
            : "Not a valid string.",
    })
    .transform((value) =>
      value.replace(
        // Python str.strip owns U+001C–001F whitespace for these REST fields.
        // eslint-disable-next-line no-control-regex
        /^[\t-\r \u001c-\u001f\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+|[\t-\r \u001c-\u001f\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$/gu,
        ""
      )
    )
    .refine((value) => !value.includes("\0"), "Null characters are not allowed.")
    .refine((value) => !/[\uD800-\uDFFF]/u.test(value), "Surrogate characters are not allowed.")
);
const catalogueApiText = catalogueApiString.refine(
  (value) => [...value].length <= 255,
  "Ensure this field has no more than 255 characters."
);
const catalogueApiRequiredText = catalogueApiText.refine((value) => value.length > 0, "This field may not be blank.");
const catalogueApiExternal = catalogueApiText.nullable();
const catalogueApiBoolean = z.preprocess(
  (value) => (value === 0 ? false : value === 1 ? true : value),
  z.union(
    [
      z.boolean(),
      z.stringbool({ truthy: ["t", "y", "yes", "true", "on", "1"], falsy: ["f", "n", "no", "false", "off", "0"] }),
    ],
    { error: (issue) => (issue.input === null ? "This field may not be null." : "Must be a valid boolean.") }
  )
);
const catalogueApiNumber = z.preprocess(
  (value) =>
    typeof value === "boolean"
      ? Number(value)
      : typeof value === "string" &&
          value.length <= 1000 &&
          /^[+-]?(?:(?:\d(?:_?\d)*)?(?:\.\d(?:_?\d)*)|\d(?:_?\d)*\.?)(?:[eE][+-]?\d(?:_?\d)*)?$/.test(value.trim())
        ? Number(value.replaceAll("_", ""))
        : value,
  z.number({
    error: (issue) =>
      issue.input === null
        ? "This field may not be null."
        : typeof issue.input === "string" && [...issue.input].length > 1000
          ? "String value too large."
          : "A valid number is required.",
  })
);
const stateApiFields = z.object({
  name: catalogueApiRequiredText,
  color: catalogueApiText,
  description: catalogueApiString.default(""),
  group: stateApiGroup.default("backlog"),
  sequence: catalogueApiNumber.default(65535),
  default: catalogueApiBoolean.default(false),
  is_triage: catalogueApiBoolean.default(false),
  external_source: catalogueApiExternal.default(null),
  external_id: catalogueApiExternal.default(null),
});
// Validate only supplied PATCH fields. Its defaulted partial output is never applied.
export const stateApiSupplied = stateApiFields.extend({ color: catalogueApiRequiredText }).partial();
export const stateApiInput = stateApiFields.transform(({ group, ...fields }, ctx) => {
  if (group === "triage") {
    ctx.issues.push({
      code: "custom",
      input: group,
      message: "Cannot create triage state",
      path: ["non_field_errors"],
    });
    return z.NEVER;
  }
  return { ...fields, group };
});
export const labelApiInput = z.object({
  name: catalogueApiRequiredText,
  color: catalogueApiText.default(""),
  description: catalogueApiString.default(""),
  parent: apiIdSchema.nullable().default(null),
  sort_order: catalogueApiNumber.default(65535),
  external_source: catalogueApiExternal.default(null),
  external_id: catalogueApiExternal.default(null),
});
export const catalogueApiBody = z.record(z.string(), z.json());
// The registered collection accepts integration lookup and reports unsupported edition filters.
export const taskApiCollectionOptions = z.object({
  external_id: z.string().optional(),
  external_source: z.string().optional(),
  pql: z.string().optional(),
  filters: z.string().optional(),
});
export const taskApiUnsupportedFilter = taskApiCollectionOptions.pick({ pql: true, filters: true }).keyof();
// Registered Issue/Work Item serializer fields; paginated list/write contracts are separate.
export const taskApiField = z.enum([
  "parent",
  "state",
  "point",
  "estimate_point",
  "name",
  "description_html",
  "description_binary",
  "priority",
  "start_date",
  "target_date",
  "assignees",
  "sequence_id",
  "labels",
  "sort_order",
  "completed_at",
  "archived_at",
  "is_draft",
  "external_source",
  "external_id",
  "type",
  "project",
  "workspace",
  "id",
  "created_at",
  "updated_at",
  "created_by",
  "updated_by",
  "deleted_at",
  "type_id",
]);
export const catalogueApiResource = z.enum(["states", "labels"]);
export const catalogueApiField = z.enum([
  "id",
  "created_at",
  "updated_at",
  "deleted_at",
  "created_by",
  "updated_by",
  "workspace",
  "project",
  "name",
  "description",
  "color",
  "slug",
  "sequence",
  "group",
  "is_triage",
  "default",
  "external_source",
  "external_id",
  "parent",
  "sort_order",
]);
export const stateApiField = catalogueApiField.exclude(["parent", "sort_order"]);
export const labelApiField = catalogueApiField.exclude(["slug", "sequence", "group", "is_triage", "default"]);
export const catalogueApiValidationFailure = z.object({
  status: z.literal(400),
  errors: z.record(z.string(), z.array(z.string())),
});
export const catalogueApiFailure = z.object({
  status: z.union([z.literal(400), z.literal(404), z.literal(409)]),
  error: z.string(),
  id: apiIdSchema.optional(),
});
export const stateContentFields = {
  name: v.string(),
  description: v.string(),
  color: v.string(),
  status,
};
export const stateFields = {
  ...stateContentFields,
  sortOrder: v.number(),
  isDefault: v.boolean(),
};
export const stateWriteFields = {
  ...stateFields,
  isTriage: v.boolean(),
  externalSource: v.optional(v.union(v.string(), v.null())),
  externalId: v.optional(v.union(v.string(), v.null())),
};
export const labelFields = { name: v.string(), description: v.string(), color: v.string(), sortOrder: v.number() };
export const labelWriteFields = {
  ...labelFields,
  parentId: v.union(v.id("taskLabels"), v.null()),
  externalSource: v.optional(v.union(v.string(), v.null())),
  externalId: v.optional(v.union(v.string(), v.null())),
};
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
const labelRemovalPhase = v.union(
  v.literal("discover"),
  v.literal("tasks"),
  v.literal("drafts"),
  v.literal("documents"),
  v.literal("views"),
  v.literal("delete")
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
    // Optional only during exact-preimage adoption; allocated UUIDs are immutable.
    apiId: v.optional(zodToConvex(apiIdSchema)),
    // Null means no updater at creation, or explicitly unrecorded historical provenance.
    updatedBy: v.optional(v.union(v.id("users"), v.null())),
    // The current native product has no IssueType assignment producer.
    type: v.optional(v.null()),
    // Legacy integer points are separate from estimatePointId; current native creation is unassigned.
    point: v.optional(v.union(v.number(), v.null())),
    // Optional only until exact-preimage adoption records explicit unassigned metadata.
    externalSource: v.optional(v.union(v.string(), v.null())),
    externalId: v.optional(v.union(v.string(), v.null())),
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
    targetDateMissing: v.boolean(),
    priorityOrder: v.number(),
    createdBy: v.id("users"),
    updatedAt: v.number(),
    titleUpdatedAt: v.number(),
    upVoteCount: v.number(),
    downVoteCount: v.number(),
    ...taskProperties,
    completedAt: v.union(v.number(), v.null()),
  })
    .index("by_api_id", ["apiId"])
    .index("by_project_external", ["projectId", "externalSource", "externalId", "deletedAt"])
    .index("by_project", ["projectId"])
    .index("by_project_status", ["projectId", "status"])
    .index("by_project_sequence", ["projectId", "sequence"])
    .index("by_project_updated", ["projectId", "updatedAt"])
    .index("by_project_state_order", ["projectId", "stateId", "status", "deletedAt", "sortOrder"])
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_target", ["workspaceId", "targetDate"])
    .index("by_workspace_target_date", ["workspaceId", "targetDateMissing", "targetDate", "createdAtDescending"])
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
    automation: v.optional(v.literal(true)),
    commentId: v.optional(v.id("taskComments")),
    changes: v.optional(v.array(taskChange)),
    kind: taskEventKind,
    status: taskStatus,
  })
    .index("by_task", ["taskId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_actor", ["workspaceId", "actorId"]),
  taskStates: defineTable({
    ...catalogueHistoryFields,
    isTriage: stateTriage,
    deletedAt: stateRetirement,
    slug: v.optional(v.string()),
    apiId: zodToConvex(apiIdSchema),
    ...stateFields,
    status: taskStatus,
    workspaceId: v.id("workspaces"),
    projectId: v.id("projects"),
  })
    .index("by_api_id", ["apiId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_project_name", ["projectId", "name"])
    .index("by_project_order", ["projectId", "sortOrder"])
    .index("by_project_default", ["projectId", "isDefault"]),
  labelRemovalJobs: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.id("projects"),
    rootLabelId: v.optional(v.id("taskLabels")),
    // Historical completed/cancelled jobs never captured an owned root revision.
    rootRevision: v.optional(v.number()),
    name: v.string(),
    phase: labelRemovalPhase,
    changed: v.number(),
    started: v.boolean(),
    status: v.union(v.literal("running"), v.literal("completed"), v.literal("cancelled")),
    // Migration only; remove after exact historical coverage and second zero pass.
    labelIds: v.optional(v.array(v.id("taskLabels"))),
    documentLabelIndex: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
  }).index("by_project", ["projectId"]),
  labelRemovalWork: defineTable({
    jobId: v.id("labelRemovalJobs"),
    labelId: v.id("taskLabels"),
    phase: labelRemovalPhase,
    cursor: v.union(v.string(), v.null()),
  })
    .index("by_job_label", ["jobId", "labelId"])
    .index("by_job_phase", ["jobId", "phase"]),
  taskLabels: defineTable({
    ...catalogueHistoryFields,
    apiId: v.optional(zodToConvex(apiIdSchema)),
    ...labelFields,
    workspaceId: v.id("workspaces"),
    projectId: v.union(v.id("projects"), v.null()),
    parentId: v.union(v.id("taskLabels"), v.null()),
    revision: v.number(),
    retiring: v.boolean(),
  })
    .index("by_api_id", ["apiId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_project_name", ["projectId", "name"])
    .index("by_project_order", ["projectId", "sortOrder"])
    .index("by_parent", ["parentId"]),
};

export async function allocateTaskApiId(ctx: MutationCtx) {
  const apiId = apiIdSchema.parse(crypto.randomUUID());
  const existing = await ctx.db
    .query("tasks")
    .withIndex("by_api_id", (q) => q.eq("apiId", apiId))
    .unique();
  if (existing) throw new ConvexError("Task API identifier already exists.");
  return apiId;
}

export async function allocateTaskStateApiId(ctx: MutationCtx) {
  const apiId = apiIdSchema.parse(crypto.randomUUID());
  const existing = await ctx.db
    .query("taskStates")
    .withIndex("by_api_id", (q) => q.eq("apiId", apiId))
    .unique();
  if (existing) throw new ConvexError("State API identifier already exists.");
  return apiId;
}

export async function allocateTaskLabelApiId(ctx: MutationCtx) {
  const apiId = apiIdSchema.parse(crypto.randomUUID());
  if (
    await ctx.db
      .query("taskLabels")
      .withIndex("by_api_id", (q) => q.eq("apiId", apiId))
      .unique()
  )
    throw new ConvexError("Label API identifier already exists.");
  return apiId;
}
export function stateSlug(name: string) {
  return name
    .normalize("NFKD")
    .split("")
    .filter((character) => character.charCodeAt(0) < 128)
    .join("")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[-\s]+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
}

// Temporary native write gate. Delete after adoption is complete and these
// stored fields are required by the table schema.
export function requireTaskLabelAdopted(label: Doc<"taskLabels">) {
  if (
    label.apiId === undefined ||
    label.createdBy === undefined ||
    label.updatedBy === undefined ||
    label.updatedAt === undefined ||
    label.externalSource === undefined ||
    label.externalId === undefined
  )
    throw new ConvexError("Label catalogue requires explicit adoption before writing.");
}
