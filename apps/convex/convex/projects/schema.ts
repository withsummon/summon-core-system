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
export const projectInactivityTables = {
  projectInactivityPolicies: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.id("projects"),
    ...inactivityPolicyFields,
    configuredBy: v.id("users"),
    revision: v.number(),
  }).index("by_project", ["projectId"]),
};
