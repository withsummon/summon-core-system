import { v } from "convex/values";
import type { Infer } from "convex/values";
export const preferences = v.object({
  theme: v.object({
    theme: v.optional(v.string()),
    primary: v.optional(v.string()),
    background: v.optional(v.string()),
    darkPalette: v.optional(v.boolean()),
  }),
  language: v.string(),
  startOfWeek: v.number(),
  appRailDocked: v.boolean(),
  smoothCursor: v.boolean(),
  notificationViewMode: v.union(v.literal("full"), v.literal("compact")),
  onboarding: v.object({
    profileComplete: v.boolean(),
    workspaceCreate: v.boolean(),
    workspaceInvite: v.boolean(),
    workspaceJoin: v.boolean(),
  }),
  isOnboarded: v.boolean(),
  tourCompleted: v.boolean(),
  navigationTourCompleted: v.boolean(),
  useCase: v.union(v.string(), v.null()),
  jobRole: v.union(v.string(), v.null()),
  lastWorkspaceId: v.union(v.id("workspaces"), v.null()),
});
export const defaultPreferences: Infer<typeof preferences> = {
  theme: {},
  language: "en",
  startOfWeek: 0,
  appRailDocked: true,
  smoothCursor: false,
  notificationViewMode: "full",
  onboarding: { profileComplete: false, workspaceCreate: false, workspaceInvite: false, workspaceJoin: false },
  isOnboarded: false,
  tourCompleted: false,
  navigationTourCompleted: false,
  useCase: null,
  jobRole: null,
  lastWorkspaceId: null,
};
