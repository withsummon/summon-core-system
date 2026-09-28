/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { PlaneLockup, ChevronLeftIcon } from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";
import { EOnboardingSteps } from "@plane/types";
import { cn } from "@plane/utils";
// hooks
// local imports
import { SwitchAccountDropdown } from "./switch-account-dropdown";

type OnboardingHeaderProps = {
  currentStep: EOnboardingSteps;
  updateCurrentStep: (step: EOnboardingSteps) => void;
  hasInvitations: boolean;
  pending: boolean;
};

export function OnboardingHeader(props: OnboardingHeaderProps) {
  const { currentStep, updateCurrentStep, hasInvitations, pending } = props;

  // handle step back
  const handleStepBack = () => {
    switch (currentStep) {
      case EOnboardingSteps.WORKSPACE_CREATE_OR_JOIN:
        updateCurrentStep(EOnboardingSteps.PROFILE_SETUP);
        break;
    }
  };

  // can go back
  const canGoBack = ![EOnboardingSteps.PROFILE_SETUP, EOnboardingSteps.INVITE_MEMBERS].includes(currentStep);

  // step order for progress tracking — include INVITE_MEMBERS if user is currently on it
  const showInviteStep = !hasInvitations || currentStep === EOnboardingSteps.INVITE_MEMBERS;
  const stepOrder: EOnboardingSteps[] = [
    EOnboardingSteps.PROFILE_SETUP,
    EOnboardingSteps.WORKSPACE_CREATE_OR_JOIN,
    ...(showInviteStep ? [EOnboardingSteps.INVITE_MEMBERS] : []),
  ];

  // derived values
  const currentStepNumber = stepOrder.indexOf(currentStep) + 1;
  const totalSteps = stepOrder.length;

  return (
    <div className="sticky top-0 z-10 flex flex-col gap-4">
      <div className="h-1.5 w-full cursor-pointer overflow-hidden rounded-t-lg bg-surface-1">
        <Tooltip tooltipContent={`${currentStepNumber}/${totalSteps}`} position="bottom-end">
          <div
            className="h-full bg-accent-primary transition-all duration-700 ease-out"
            style={{ width: `${(currentStepNumber / totalSteps) * 100}%` }}
          />
        </Tooltip>
      </div>
      <div className={cn("flex w-full items-center justify-between gap-6 px-6", canGoBack && "pr-6 pl-4")}>
        <div className="flex items-center gap-2.5">
          {canGoBack && (
            <button
              onClick={handleStepBack}
              className="cursor-pointer"
              type="button"
              disabled={pending}
              aria-label="Back to previous onboarding step"
            >
              <ChevronLeftIcon className="size-6 text-placeholder" />
            </button>
          )}
          <PlaneLockup height={20} width={95} className="text-primary" />
        </div>
        <SwitchAccountDropdown disabled={pending} />
      </div>
    </div>
  );
}
