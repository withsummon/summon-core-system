import { projectNavigation } from "../../shared/project-navigation";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { projectLogoProps } from "./branding_schema";
import { projectNetwork } from "./network_schema";
import { defaultProjectFeatures, projectFeatures } from "./feature_schema";
import { z } from "zod/v4";
import { convexToZod, zodToConvex } from "convex-helpers/server/zod4";
import { apiIdSchema } from "../identity/schema";

export const projectJson = z.json();
export const projectJsonText = z
  .string()
  .transform((text, ctx) => {
    try {
      return JSON.parse(text);
    } catch {
      ctx.addIssue({ code: "custom", message: "Enter valid project JSON." });
      return z.NEVER;
    }
  })
  .pipe(projectJson);
export const projectApiData = z.object({
  emoji: z.string().max(255).nullable().default(null),
  iconPropsJson: projectJsonText
    .transform((value) => JSON.stringify(value))
    .nullable()
    .default(null),
  descriptionTextJson: projectJsonText
    .transform((value) => JSON.stringify(value))
    .nullable()
    .default(null),
  descriptionHtmlJson: projectJsonText
    .transform((value) => JSON.stringify(value))
    .nullable()
    .default(null),
  externalSource: z.string().max(255).nullable().default(null),
  externalId: z.string().max(255).nullable().default(null),
  issueTypeEnabled: z.boolean().default(false),
  timeTrackingEnabled: z.boolean().default(false),
});
export const projectApiCreate = z.object({
  name: z.string(),
  identifier: z.string(),
  description: z.string().default(""),
  project_lead: apiIdSchema.nullable().default(null),
  default_assignee: apiIdSchema.nullable().default(null),
  icon_prop: projectJson.default(null),
  emoji: projectApiData.shape.emoji,
  cover_image: z.string().nullable().default(null),
  module_view: z.boolean().default(false),
  cycle_view: z.boolean().default(false),
  issue_views_view: z.boolean().default(false),
  page_view: z.boolean().default(true),
  intake_view: z.boolean().default(false),
  guest_view_all_features: z.boolean().default(false),
  archive_in: z.int().min(0).max(12).default(0),
  close_in: z.int().min(0).max(12).default(0),
  timezone: z.string().optional(),
  external_source: projectApiData.shape.externalSource,
  external_id: projectApiData.shape.externalId,
  is_issue_type_enabled: projectApiData.shape.issueTypeEnabled,
  is_time_tracking_enabled: projectApiData.shape.timeTrackingEnabled,
});
export const projectApiField = z.enum([
  "id",
  "created_at",
  "updated_at",
  "deleted_at",
  "name",
  "description",
  "description_text",
  "description_html",
  "network",
  "identifier",
  "emoji",
  "icon_prop",
  "module_view",
  "cycle_view",
  "issue_views_view",
  "page_view",
  "intake_view",
  "is_time_tracking_enabled",
  "is_issue_type_enabled",
  "guest_view_all_features",
  "cover_image",
  "cover_image_asset",
  "estimate",
  "archive_in",
  "close_in",
  "logo_props",
  "archived_at",
  "timezone",
  "external_source",
  "external_id",
  "created_by",
  "updated_by",
  "workspace",
  "default_assignee",
  "project_lead",
  "default_state",
  "total_members",
  "total_cycles",
  "total_modules",
  "is_member",
  "member_role",
  "is_deployed",
  "cover_image_url",
  "sort_order",
]);
export const projectApiOrder = z.enum(["created_at", "updated_at", "name", "network", "sort_order"]);
export const projectApiReference = projectApiField.extract([
  "workspace",
  "created_by",
  "updated_by",
  "project_lead",
  "default_assignee",
  "default_state",
  "estimate",
  "cover_image_asset",
]);
export const projectApiReadOptions = z.object({
  fields: z
    .string()
    .default("")
    .transform((value) => value.split(",").filter(Boolean))
    .transform((value) => (value.length ? value : null)),
  expand: z
    .string()
    .default("")
    .transform((value) => value.split(",").filter(Boolean)),
  per_page: z.coerce.number().int().min(1).max(1000).default(1000),
  cursor: z
    .string()
    .regex(/^\d+(?:\.\d+)?:\d+:[01]$/)
    .default("0:0:0")
    .transform((value) => Number(value.split(":")[1]))
    .pipe(z.int().nonnegative()),
  order_by: z.string().default("sort_order"),
});
export const projectApiFailure = z.object({
  status: z.union([z.literal(400), z.literal(403), z.literal(404), z.literal(409), z.literal(503)]),
  detail: z.string(),
});

export const inactivityMonths = v.union(
  v.literal(1),
  v.literal(2),
  v.literal(3),
  v.literal(4),
  v.literal(5),
  v.literal(6),
  v.literal(7),
  v.literal(8),
  v.literal(9),
  v.literal(10),
  v.literal(11),
  v.literal(12)
);
export const inactivityPolicyFields = {
  archiveMonths: v.union(v.literal(0), ...inactivityMonths.members),
  close: v.union(v.null(), v.object({ months: inactivityMonths, stateId: v.id("taskStates") })),
};
export const inactivityPolicy = v.object(inactivityPolicyFields);

export const projectCreateArgs = v.object({
  workspaceId: v.id("workspaces"),
  name: v.string(),
  identifier: v.string(),
  network: v.optional(projectNetwork),
  logoProps: v.optional(projectLogoProps),
  description: v.optional(v.string()),
  leadId: v.optional(v.union(v.id("users"), v.null())),
  timezone: v.optional(v.string()),
  defaultAssigneeId: v.optional(v.union(v.id("users"), v.null())),
  features: v.optional(projectFeatures),
  intakeEnabled: v.optional(v.boolean()),
  guestViewAllFeatures: v.optional(v.boolean()),
  externalCoverUrl: v.optional(v.union(v.string(), v.null())),
  archiveMonths: v.optional(inactivityPolicyFields.archiveMonths),
  closeMonths: v.optional(inactivityPolicyFields.archiveMonths),
  ...zodToConvex(projectApiData).fields,
});
const createInput = convexToZod(projectCreateArgs);
export const projectCreateInput = createInput.extend({
  description: createInput.shape.description.default(""),
  leadId: createInput.shape.leadId.default(null),
  defaultAssigneeId: createInput.shape.defaultAssigneeId.default(null),
  logoProps: createInput.shape.logoProps.default({}),
  features: createInput.shape.features.default(defaultProjectFeatures),
  network: createInput.shape.network.default(2),
  intakeEnabled: createInput.shape.intakeEnabled.default(false),
  guestViewAllFeatures: createInput.shape.guestViewAllFeatures.default(false),
  archiveMonths: createInput.shape.archiveMonths.default(0),
  closeMonths: createInput.shape.closeMonths.default(0),
});
export const projectPersonalTables = {
  projectUserProperties: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.id("projects"),
    userId: v.id("users"),
    sortOrder: v.number(),
    revision: v.number(),
    navigation: v.optional(projectNavigation),
  })
    .index("by_project_user", ["projectId", "userId"])
    .index("by_owner_order", ["workspaceId", "userId", "sortOrder"]),
};

export const projectInactivityTables = {
  projectInactivityPolicies: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.id("projects"),
    ...inactivityPolicyFields,
    configuredBy: v.id("users"),
    revision: v.number(),
  }).index("by_project", ["projectId"]),
};
