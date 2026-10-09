import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { defaultProfile, ownProfile, profileRevision, writeProfile } from "./profile_owner";
import { requireWorkspace } from "./access";

async function finish(
  ctx: MutationCtx,
  args: { expectedRevision: number; workspaceId: Id<"workspaces"> },
  step: "qa" | "finish" | "invite"
) {
  const owner = await ownProfile(ctx);
  const revision = profileRevision(owner.profile, args.expectedRevision);
  const profile = owner.profile ?? defaultProfile;
  const { workspace } = await requireWorkspace(ctx, args.workspaceId);
  const onboarding = { ...profile.preferences.onboarding };
  if (step === "qa") {
    onboarding.profileComplete = true;
    onboarding.workspaceJoin = true;
  } else {
    if (!onboarding.profileComplete) throw new ConvexError("Complete your profile first.");
    if (step === "invite") {
      if (!onboarding.workspaceCreate || profile.preferences.lastWorkspaceId !== workspace._id)
        throw new ConvexError("Complete workspace creation before the invitation step.");
      onboarding.workspaceInvite = true;
    }
  }
  await writeProfile(ctx, owner, {
    revision,
    preferences: { ...profile.preferences, lastWorkspaceId: workspace._id, isOnboarded: true, onboarding },
  });
  return { workspaceId: workspace._id, slug: workspace.slug };
}

// The current /core QA consumer owns these historical completion semantics.
export const complete = mutation({
  args: { expectedRevision: v.number(), workspaceId: v.id("workspaces") },
  handler: (ctx, args) => finish(ctx, args, "qa"),
});
export const completePreserved = mutation({
  args: { expectedRevision: v.number(), workspaceId: v.id("workspaces"), inviteStepCompleted: v.boolean() },
  handler: (ctx, args) => finish(ctx, args, args.inviteStepCompleted ? "invite" : "finish"),
});

export async function recordWorkspaceCreation(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  expectedRevision: number,
  organizationSize: string | null
) {
  const owner = await ownProfile(ctx);
  const revision = profileRevision(owner.profile, expectedRevision);
  const profile = owner.profile ?? defaultProfile;
  if (!profile.preferences.onboarding.profileComplete) throw new ConvexError("Complete your profile first.");
  if (!organizationSize) throw new ConvexError("Choose an organization size.");
  await requireWorkspace(ctx, workspaceId, true);
  await writeProfile(ctx, owner, {
    revision,
    preferences: {
      ...profile.preferences,
      lastWorkspaceId: workspaceId,
      onboarding: {
        ...profile.preferences.onboarding,
        workspaceCreate: profile.preferences.onboarding.workspaceCreate || organizationSize !== "Just myself",
      },
    },
  });
}
