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
  ...authTables,
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
  workspaces: defineTable({ name: v.string(), slug: v.string() }).index("by_slug", ["slug"]),
  workspaceMembers: defineTable({ workspaceId: v.id("workspaces"), userId: v.id("users"), role, active: v.boolean() })
    .index("by_workspace_user", ["workspaceId", "userId"])
    .index("by_user", ["userId"])
    .index("by_workspace_role_active", ["workspaceId", "role", "active"]),
  projects: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    identifier: v.string(),
    nextSequence: v.number(),
    archived: v.boolean(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_identifier", ["workspaceId", "identifier"]),
  projectMembers: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.id("projects"),
    userId: v.id("users"),
    role,
    active: v.boolean(),
  })
    .index("by_project_user", ["projectId", "userId"])
    .index("by_workspace_user", ["workspaceId", "userId"])
    .index("by_project_role_active", ["projectId", "role", "active"]),
});
