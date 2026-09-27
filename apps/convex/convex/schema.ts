import { navigationTables } from "./navigation/schema";
import { estimateTables } from "./estimates/schema";
import { favoriteTables } from "./favorites/schema";
import { draftTables } from "./tasks/drafts/schema";
import { stickyTables } from "./stickies/schema";
import { savedViewTables } from "./savedViews/schema";
import { identityTables } from "./identity/schema";
import { intakeTables } from "./intakes/schema";
import { quickLinkTables } from "./quickLinks/schema";
import { moduleTables } from "./modules/schema";
import { cycleTables } from "./cycles/schema";
import { notificationTables } from "./notifications/schema";
import { automationTables } from "./automation/schema";
import { mcpTables } from "./mcp/schema";
import { assistantTables } from "./assistant/schema";
import { taskTables } from "./tasks/schema";
import { assetTables } from "./assets/schema";
import { settingsTables } from "./settings/schema";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import { meetingTables } from "./meetings/schema";
import { commercialTables } from "./commercial/schema";
import { documentTables } from "./documents/schema";
import { resourceTables } from "./resources/schema";

export const role = v.union(v.literal("admin"), v.literal("member"), v.literal("guest"));
export default defineSchema({
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
  workspaces: defineTable({ name: v.string(), slug: v.string(), metadataRevision: v.number() }).index("by_slug", [
    "slug",
  ]),
  workspaceMembers: defineTable({ workspaceId: v.id("workspaces"), userId: v.id("users"), role, active: v.boolean() })
    .index("by_workspace_user", ["workspaceId", "userId"])
    .index("by_user", ["userId"])
    .index("by_workspace_role_active", ["workspaceId", "role", "active"]),
  projects: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    identifier: v.string(),
    timezone: v.optional(v.string()),
    description: v.optional(v.string()),
    metadataRevision: v.optional(v.number()),
    intakeEnabled: v.optional(v.boolean()),
    guestViewAllFeatures: v.optional(v.boolean()),
    nextSequence: v.number(),
    archived: v.boolean(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_identifier", ["workspaceId", "identifier"]),
  invitations: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.union(v.id("projects"), v.null()),
    email: v.string(),
    role,
    inviterId: v.id("users"),
    tokenHash: v.string(),
    expiresAt: v.number(),
    revision: v.number(),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("declined"), v.literal("revoked")),
    respondedAt: v.union(v.number(), v.null()),
    respondedBy: v.union(v.id("users"), v.null()),
  })
    .index("by_scope_email", ["workspaceId", "projectId", "email", "status"])
    .index("by_scope", ["workspaceId", "projectId"])
    .index("by_email", ["email", "status"]),
  projectMembers: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.id("projects"),
    userId: v.id("users"),
    role,
    active: v.boolean(),
  })
    .index("by_project_user", ["projectId", "userId"])
    .index("by_user", ["userId"])
    .index("by_workspace_user", ["workspaceId", "userId"])
    .index("by_project_role_active", ["projectId", "role", "active"]),
});
