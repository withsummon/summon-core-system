import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import type { Infer } from "convex/values";
import { preferences } from "./preferences_fields";
import { defaultProfile, ownProfile, profileRevision, writeProfile } from "./profile_owner";
import { requireWorkspace } from "./access";
function validatePreferences(value: Infer<typeof preferences>) {
  if (!Number.isInteger(value.startOfWeek) || value.startOfWeek < 0 || value.startOfWeek > 6)
    throw new ConvexError("Choose a week start from Sunday (0) through Saturday (6).");
  if (!value.language.trim() || value.language.length > 255)
    throw new ConvexError("Language must contain 1–255 characters.");
  if (value.useCase !== null && value.useCase.length > 20000)
    throw new ConvexError("Use case must be at most 20,000 characters.");
  if (value.jobRole !== null && value.jobRole.length > 300)
    throw new ConvexError("Job role must be at most 300 characters.");
  validateTheme(value.theme);
}
function validateTheme(theme: Infer<typeof preferences>["theme"]) {
  if (
    theme.theme !== undefined &&
    !["light", "dark", "system", "custom", "light-contrast", "dark-contrast"].includes(theme.theme)
  )
    throw new ConvexError("Choose a supported appearance theme.");
  for (const color of [theme.primary, theme.background]) {
    if (color !== undefined && !/^#(?:[a-f0-9]{3}|[a-f0-9]{6})$/i.test(color))
      throw new ConvexError("Custom theme colors must be hexadecimal colors.");
  }
}
export const save = mutation({
  args: { expectedRevision: v.number(), preferences },
  handler: async (ctx, args) => {
    const owner = await ownProfile(ctx);
    const revision = profileRevision(owner.profile, args.expectedRevision);
    validatePreferences(args.preferences);
    if (args.preferences.lastWorkspaceId) await requireWorkspace(ctx, args.preferences.lastWorkspaceId);
    await writeProfile(ctx, owner, { preferences: args.preferences, revision });
  },
});

// Workspace selection is a field-level action, not a full preference form save.
export const selectWorkspace = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const owner = await ownProfile(ctx);
    const { workspace } = await requireWorkspace(ctx, workspaceId);
    const profile = owner.profile ?? defaultProfile;
    if (profile.preferences.lastWorkspaceId !== workspaceId)
      await writeProfile(ctx, owner, {
        revision: profile.revision + 1,
        preferences: { ...profile.preferences, lastWorkspaceId: workspaceId },
      });
    return { workspaceId: workspace._id, slug: workspace.slug };
  },
});
