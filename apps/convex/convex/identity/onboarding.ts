import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { defaultProfile, ownProfile, profileRevision, writeProfile } from "./profile_owner";
import { requireWorkspace } from "./access";
export const complete = mutation({
  args: { expectedRevision: v.number(), workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const owner = await ownProfile(ctx);
    const revision = profileRevision(owner.profile, args.expectedRevision);
    const profile = owner.profile ?? defaultProfile;
    const { workspace } = await requireWorkspace(ctx, args.workspaceId);
    await writeProfile(ctx, owner, {
      revision,
      preferences: {
        ...profile.preferences,
        lastWorkspaceId: args.workspaceId,
        isOnboarded: true,
        onboarding: { ...profile.preferences.onboarding, profileComplete: true, workspaceJoin: true },
      },
    });
    return { workspaceId: workspace._id, slug: workspace.slug };
  },
});
