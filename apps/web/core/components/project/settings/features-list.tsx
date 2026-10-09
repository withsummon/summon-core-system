/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import type { ReactNode } from "react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
// plane imports
import { useTranslation } from "@plane/i18n";
import { setPromiseToast } from "@plane/propel/toast";
import { Tooltip } from "@plane/propel/tooltip";
import type { IProject } from "@plane/types";
import { CycleIcon, IntakeIcon, ModuleIcon, PageIcon, ViewsIcon } from "@plane/propel/icons";
// components
import { SettingsBoxedControlItem } from "@/components/settings/boxed-control-item";
import { SettingsHeading } from "@/components/settings/heading";
// hooks
import { useProject } from "@/hooks/store/use-project";
// plane web imports
import { UpgradeBadge } from "@/components/workspace/upgrade-badge";
// local imports
import { ProjectFeatureToggle } from "./helper";

type Props = {
  workspaceSlug: string;
  projectId: string;
  isAdmin: boolean;
};

type Feature = keyof FunctionReturnType<typeof api.projects.features.get>["features"];

const PROJECT_FEATURES_LIST = {
  cycles: {
    key: "cycles",
    property: "cycle_view",
    title: "Cycles",
    description: "Timebox work as you see fit per project and change frequency from one period to the next.",
    icon: <CycleIcon className="h-5 w-5 flex-shrink-0 rotate-180 text-tertiary" />,
    isPro: false,
    isEnabled: true,
  },
  modules: {
    key: "modules",
    property: "module_view",
    title: "Modules",
    description: "Group work into sub-project-like set-ups with their own leads and assignees.",
    icon: <ModuleIcon width={20} height={20} className="flex-shrink-0 text-tertiary" />,
    isPro: false,
    isEnabled: true,
  },
  views: {
    key: "views",
    property: "issue_views_view",
    title: "Views",
    description: "Save sorts, filters, and display options for later or share them.",
    icon: <ViewsIcon className="h-5 w-5 flex-shrink-0 text-tertiary" />,
    isPro: false,
    isEnabled: true,
  },
  pages: {
    key: "pages",
    property: "page_view",
    title: "Pages",
    description: "Write anything like you write anything.",
    icon: <PageIcon className="h-5 w-5 flex-shrink-0 text-tertiary" />,
    isPro: false,
    isEnabled: true,
  },
  intake: {
    key: "intake",
    property: "inbox_view",
    title: "Intake",
    description: "Consider and discuss work items before you add them to your project.",
    icon: <IntakeIcon className="h-5 w-5 flex-shrink-0 text-tertiary" />,
    isPro: false,
    isEnabled: true,
  },
} as const satisfies Record<
  Feature,
  {
    key: Feature;
    property: keyof IProject;
    title: string;
    description: string;
    icon: ReactNode;
    isPro: boolean;
    isEnabled: boolean;
  }
>;

export const ProjectFeaturesList = observer(function ProjectFeaturesList(props: Props) {
  const { workspaceSlug, projectId, isAdmin } = props;
  // store hooks
  const { getProjectById, updateProject } = useProject();
  // derived values
  const currentProjectDetails = getProjectById(projectId);

  const handleSubmit = (feature: Feature) => {
    const featureProperty = PROJECT_FEATURES_LIST[feature].property;
    if (!workspaceSlug || !projectId || !currentProjectDetails) return;

    // making the request to update the project feature
    const settingsPayload = {
      [featureProperty]: !currentProjectDetails?.[featureProperty],
    };
    const updateProjectPromise = updateProject(workspaceSlug, projectId, settingsPayload);

    setPromiseToast(updateProjectPromise, {
      loading: "Updating project feature...",
      success: {
        title: "Success!",
        message: () => "Project feature updated successfully.",
      },
      error: {
        title: "Error!",
        message: () => "Something went wrong while updating project feature. Please try again.",
      },
    });
    void updateProjectPromise.then(() => {
      return undefined;
    });
  };

  return (
    <ProjectFeaturesListView
      renderControl={(feature) => {
        const featureItem = PROJECT_FEATURES_LIST[feature];
        return (
          <ProjectFeatureToggle
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            featureItem={featureItem}
            value={Boolean(currentProjectDetails?.[featureItem.property])}
            handleSubmit={() => handleSubmit(feature)}
            disabled={!isAdmin}
          />
        );
      }}
    />
  );
});

export function ProjectFeaturesListView({ renderControl }: { renderControl: (feature: Feature) => ReactNode }) {
  const { t } = useTranslation();
  return (
    <div>
      <SettingsHeading title={t("projects_and_issues")} description={t("projects_and_issues_description")} />
      <div className="mt-6 flex flex-col gap-y-4">
        {Object.values(PROJECT_FEATURES_LIST).map((featureItem) => (
          <SettingsBoxedControlItem
            key={featureItem.key}
            title={
              <span className="flex items-center gap-2">
                {t(featureItem.key)}
                {featureItem.isPro && (
                  <Tooltip tooltipContent="Pro feature" position="top">
                    <UpgradeBadge className="rounded-sm" />
                  </Tooltip>
                )}
              </span>
            }
            description={t(`${featureItem.key}_description`)}
            control={renderControl(featureItem.key)}
          />
        ))}
      </div>
    </div>
  );
}
