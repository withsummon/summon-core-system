import { defineTable } from "convex/server";
import { v } from "convex/values";

export const weekday = v.union(
  v.literal("mon"),
  v.literal("tue"),
  v.literal("wed"),
  v.literal("thu"),
  v.literal("fri"),
  v.literal("sat"),
  v.literal("sun")
);
export const settingsFields = {
  organizationSize: v.union(v.string(), v.null()),
  timezone: v.string(),
  industry: v.string(),
  description: v.string(),
  currency: v.string(),
  workweek: v.array(weekday),
};
export const settingsTables = {
  workspaceAppearance: defineTable({
    workspaceId: v.id("workspaces"),
    logoAssetId: v.union(v.id("assets"), v.null()),
  }).index("by_workspace", ["workspaceId"]),
  workspaceSettings: defineTable({ workspaceId: v.id("workspaces"), ...settingsFields }).index("by_workspace", [
    "workspaceId",
  ]),
};
