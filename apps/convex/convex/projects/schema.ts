import { projectNavigation } from "../../shared/project-navigation";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { projectLogoProps } from "./branding_schema";
import { projectNetwork } from "./network_schema";

export const projectCreateArgs = v.object({
  workspaceId: v.id("workspaces"),
  name: v.string(),
  identifier: v.string(),
  network: v.optional(projectNetwork),
  logoProps: v.optional(projectLogoProps),
  description: v.optional(v.string()),
  leadId: v.optional(v.union(v.id("users"), v.null())),
  timezone: v.optional(v.string()),
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
