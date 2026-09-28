/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { useConvex, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { EOnboardingSteps } from "@plane/types";
import { Button } from "@plane/propel/button";
import { LogoSpinner } from "@/components/common/logo-spinner";
import { AccountDestination } from "@/components/auth-screens/auth-base";
import { NativeProfileStep } from "@/components/account/native-entry/profile";
import { NativeWorkspaceCreate } from "@/components/account/native-entry/workspace-create";
import { NativeWorkspaceInvitations } from "@/components/account/native-entry/workspace-invitations";
import { NativeTeamStep } from "@/components/account/native-entry/team";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { OnboardingHeader } from "./header";

export function OnboardingRoot() {
  const profile = useQuery(api.identity.profile.get);
  const workspaces = useQuery(api.workspaces.index.list);
  const invitations = usePaginatedQuery(api.invitations.index.incoming, {}, { initialNumItems: 20 });
  if (!profile || !workspaces || invitations.status === "LoadingFirstPage")
    return (
      <div className="grid size-full place-items-center">
        <LogoSpinner />
      </div>
    );
  if (profile.preferences.isOnboarded) return <AccountDestination />;
  return (
    <OnboardingFlow
      profile={profile}
      workspaces={workspaces}
      hasInvitations={invitations.results.length > 0 || invitations.status !== "Exhausted"}
    />
  );
}

function OnboardingFlow({
  profile,
  workspaces,
  hasInvitations,
}: {
  profile: FunctionReturnType<typeof api.identity.profile.get>;
  workspaces: FunctionReturnType<typeof api.workspaces.index.list>;
  hasInvitations: boolean;
}) {
  const convex = useConvex();
  const complete = useMutation(api.identity.onboarding.completePreserved);
  const selected = workspaces.find((row) => row._id === profile.preferences.lastWorkspaceId) ?? workspaces[0];
  const [workspaceId, setWorkspaceId] = useState(selected?._id ?? null);
  const [currentStep, setCurrentStep] = useState(() => {
    const steps = profile.preferences.onboarding;
    if (!steps.profileComplete) return EOnboardingSteps.PROFILE_SETUP;
    return steps.workspaceCreate && !steps.workspaceInvite && selected
      ? EOnboardingSteps.INVITE_MEMBERS
      : EOnboardingSteps.WORKSPACE_CREATE_OR_JOIN;
  });
  const [workspaceView, setWorkspaceView] = useState(hasInvitations ? "join" : "create");
  const [pending, setPending] = useState(false);
  const [stagePending, setStagePending] = useState(false);
  const [completion, setCompletion] = useState<{ workspaceId: Id<"workspaces">; inviteStepCompleted: boolean } | null>(
    selected &&
      profile.preferences.onboarding.profileComplete &&
      (!profile.preferences.onboarding.workspaceCreate || profile.preferences.onboarding.workspaceInvite)
      ? { workspaceId: selected._id, inviteStepCompleted: false }
      : null
  );
  const [error, setError] = useState("");
  const scrollContainer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollContainer.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentStep]);

  const finish = async (id: Id<"workspaces">, inviteStepCompleted: boolean) => {
    setPending(true);
    setError("");
    setCompletion({ workspaceId: id, inviteStepCompleted });
    try {
      const latest = await convex.query(api.identity.profile.get);
      await complete({ expectedRevision: latest.revision, workspaceId: id, inviteStepCompleted });
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  };
  const profileComplete = () => {
    if (selected) void finish(selected._id, false);
    else setCurrentStep(EOnboardingSteps.WORKSPACE_CREATE_OR_JOIN);
  };
  return (
    <div className="flex h-full flex-col">
      <OnboardingHeader
        currentStep={currentStep}
        updateCurrentStep={(step) => {
          setCompletion(null);
          setCurrentStep(step);
        }}
        hasInvitations={hasInvitations}
        pending={stagePending || pending}
      />
      <div ref={scrollContainer} className="flex-1 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-8">
          <div className="w-full max-w-[24rem]">
            {completion ? (
              <div className="space-y-4">
                {pending ? (
                  <p role="status">Finishing onboarding…</p>
                ) : (
                  <>
                    {error ? (
                      <p role="alert" className="text-13 text-danger-primary">
                        {error}
                      </p>
                    ) : (
                      <p>Your workspace is ready.</p>
                    )}
                    <Button
                      className="w-full"
                      onClick={() => void finish(completion.workspaceId, completion.inviteStepCompleted)}
                    >
                      Continue
                    </Button>
                  </>
                )}
              </div>
            ) : currentStep === EOnboardingSteps.PROFILE_SETUP ? (
              <NativeProfileStep
                key={currentStep}
                profile={profile}
                onComplete={profileComplete}
                onPendingChange={setStagePending}
              />
            ) : currentStep === EOnboardingSteps.INVITE_MEMBERS && workspaceId ? (
              <NativeTeamStep
                workspaceId={workspaceId}
                onComplete={() => void finish(workspaceId, true)}
                onPendingChange={setStagePending}
              />
            ) : workspaceView === "join" ? (
              <NativeWorkspaceInvitations
                onPendingChange={setStagePending}
                onComplete={(invitation) => {
                  setWorkspaceId(invitation.workspaceId);
                  void finish(invitation.workspaceId, false);
                }}
                onCreate={() => setWorkspaceView("create")}
              />
            ) : (
              <NativeWorkspaceCreate
                onPendingChange={setStagePending}
                profileRevision={profile.revision}
                hasInvitations={hasInvitations}
                handleCurrentViewChange={() => setWorkspaceView("join")}
                onComplete={(id, skipInvites) => {
                  setWorkspaceId(id);
                  if (skipInvites) void finish(id, false);
                  else setCurrentStep(EOnboardingSteps.INVITE_MEMBERS);
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
