import { projectLogoProps } from "./projects/branding_schema";
import { projectNetwork } from "./projects/network_schema";
import { projectFeatures } from "./projects/feature_schema";
import { projectAppearanceTables } from "./projects/appearance_schema";
import {
  projectApiData,
  projectInactivityTables,
  projectPersonalTables,
  projectDeletionTables,
} from "./projects/schema";
import { navigationTables } from "./navigation/schema";
import { estimateTables } from "./estimates/schema";
import { favoriteTables } from "./favorites/schema";
import { draftTables } from "./tasks/drafts/schema";
import { stickyTables } from "./stickies/schema";
import { savedViewTables } from "./savedViews/schema";
import { apiIdSchema, identityTables } from "./identity/schema";
import { intakeTables } from "./intakes/schema";
import { publicationTables } from "./publicSharing/schema";
import { quickLinkTables } from "./quickLinks/schema";
import { moduleTables } from "./modules/schema";
import { cycleTables } from "./cycles/schema";
import { notificationTables } from "./notifications/schema";
import { automationTables } from "./automation/schema";
import { exportTables } from "./exports/schema";
import { importTables } from "./imports/schema";
import { webhookTables } from "./webhooks/schema";
import { mcpTables } from "./mcp/schema";
import { assistantTables } from "./assistant/schema";
import { taskTables } from "./tasks/schema";
import { assetTables } from "./assets/schema";
import { settingsTables } from "./settings/schema";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { zodToConvex } from "convex-helpers/server/zod4";
import { authTables } from "@convex-dev/auth/server";
import { meetingTables } from "./meetings/schema";
import { commercialTables } from "./commercial/schema";
import { documentTables } from "./documents/schema";
import { resourceTables } from "./resources/schema";

export const role = v.union(v.literal("admin"), v.literal("member"), v.literal("guest"));
export const invitationDeliveryStatus = v.union(v.literal("sent"), v.literal("failed"));
export default defineSchema({
  ...projectPersonalTables,
  ...projectInactivityTables,
  ...projectDeletionTables,
  ...projectAppearanceTables,
  ...navigationTables,
  ...estimateTables,
  ...favoriteTables,
  ...draftTables,
  ...authTables,
  ...identityTables,
  ...stickyTables,
  ...savedViewTables,
  ...quickLinkTables,
  ...cycleTables,
  ...moduleTables,
  ...notificationTables,
  ...automationTables,
  ...exportTables,
  ...importTables,
  ...webhookTables,
  ...mcpTables,
  ...assistantTables,
  ...assetTables,
  ...taskTables,
  ...meetingTables,
  ...settingsTables,
  ...commercialTables,
  ...documentTables,
  ...resourceTables,
  ...intakeTables,
  ...publicationTables,
  workspaces: defineTable({
    apiId: zodToConvex(apiIdSchema),
    // Creation records its actual owner. Historical absence is unrecorded ownership, never inferred from membership.
    ownerId: v.optional(v.id("users")),
    name: v.string(),
    slug: v.string(),
    metadataRevision: v.number(),
    deletedAt: v.optional(v.union(v.number(), v.null())),
  })
    .index("by_slug", ["slug"])
    .index("by_api_id", ["apiId"]),
  workspaceMembers: defineTable({ workspaceId: v.id("workspaces"), userId: v.id("users"), role, active: v.boolean() })
    .index("by_workspace_user", ["workspaceId", "userId"])
    .index("by_user", ["userId"])
    .index("by_workspace_role_active", ["workspaceId", "role", "active"]),
  projects: defineTable({
    apiId: zodToConvex(apiIdSchema),
    ...zodToConvex(projectApiData.partial()).fields,
    createdById: v.optional(v.union(v.id("users"), v.null())),
    updatedById: v.optional(v.union(v.id("users"), v.null())),
    updatedAt: v.optional(v.number()),
    archivedAt: v.optional(v.union(v.number(), v.null())),
    workspaceId: v.id("workspaces"),
    name: v.string(),
    identifier: v.string(),
    timezone: v.optional(v.string()),
    description: v.string(),
    metadataRevision: v.number(),
    features: v.optional(projectFeatures),
    network: v.optional(projectNetwork),
    logoProps: v.optional(projectLogoProps),
    leadId: v.optional(v.union(v.id("users"), v.null())),
    defaultAssigneeId: v.union(v.id("users"), v.null()),
    defaultStateId: v.optional(v.union(v.id("taskStates"), v.null())),
    intakeEnabled: v.optional(v.boolean()),
    guestViewAllFeatures: v.optional(v.boolean()),
    nextSequence: v.number(),
    archived: v.boolean(),
    archivedFavoriteRevision: v.optional(v.number()),
    deletedAt: v.optional(v.union(v.number(), v.null())),
  })
    .index("by_api_id", ["apiId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_identifier", ["workspaceId", "identifier"])
    .index("by_workspace_name", ["workspaceId", "name"]),
  invitations: defineTable({
    delivery: v.optional(
      v.object({
        status: invitationDeliveryStatus,
        revision: v.number(),
        attemptedAt: v.number(),
      })
    ),
    workspaceId: v.id("workspaces"),
    projectId: v.union(v.id("projects"), v.null()),
    email: v.string(),
    role,
    inviterId: v.id("users"),
    // Stored invitation hashes are removed during the ID-link cutover.
    tokenHash: v.optional(v.string()),
    expiresAt: v.number(),
    revision: v.number(),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("declined"), v.literal("revoked")),
    respondedAt: v.union(v.number(), v.null()),
    respondedBy: v.union(v.id("users"), v.null()),
  })
    .index("by_scope_email", ["workspaceId", "projectId", "email", "status"])
    .index("by_scope", ["workspaceId", "projectId"])
    .index("by_scope_status", ["workspaceId", "projectId", "status"])
    .index("by_email", ["email", "status"]),
  projectMembers: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.id("projects"),
    userId: v.id("users"),
    role,
    active: v.boolean(),
    revision: v.number(),
    apiSortOrder: v.optional(v.number()),
  })
    .index("by_project_user", ["projectId", "userId"])
    .index("by_user", ["userId"])
    .index("by_workspace_user", ["workspaceId", "userId"])
    .index("by_workspace_user_active", ["workspaceId", "userId", "active"])
    .index("by_project_role_active", ["projectId", "role", "active"]),
});
