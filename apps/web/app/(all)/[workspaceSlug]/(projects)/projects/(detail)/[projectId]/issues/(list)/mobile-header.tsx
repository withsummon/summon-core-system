/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useState } from "react";
import { observer } from "mobx-react";
import { ChartNoAxesColumn, SlidersHorizontal } from "lucide-react";
import { useParams } from "next/navigation";
// plane imports
import { EIssueFilterType, ISSUE_DISPLAY_FILTERS_BY_PAGE } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import type { IIssueDisplayFilterOptions, IIssueDisplayProperties } from "@plane/types";
import { EIssuesStoreType, EIssueLayoutTypes } from "@plane/types";
// components
import { WorkItemsModal } from "@/components/analytics/work-items/modal";
import {
  DisplayFiltersSelection,
  FiltersDropdown,
  MobileLayoutSelection,
} from "@/components/issues/issue-layouts/filters";
// hooks
import { useIssues } from "@/hooks/store/use-issues";
import { useProject } from "@/hooks/store/use-project";

export const ProjectIssuesMobileHeader = observer(function ProjectIssuesMobileHeader() {
  // i18n
  const { t } = useTranslation();
  const [analyticsModal, setAnalyticsModal] = useState(false);
  const { workspaceSlug, projectId } = useParams();
  const { currentProjectDetails } = useProject();

  // store hooks
  const {
    issuesFilter: { issueFilters, updateFilters },
  } = useIssues(EIssuesStoreType.PROJECT);
  const activeLayout = issueFilters?.displayFilters?.layout;

  const handleLayoutChange = useCallback(
    (layout: EIssueLayoutTypes) => {
      if (!workspaceSlug || !projectId) return;
      updateFilters(workspaceSlug, projectId, EIssueFilterType.DISPLAY_FILTERS, { layout: layout });
    },
    [workspaceSlug, projectId, updateFilters]
  );

  const handleDisplayFilters = useCallback(
    (updatedDisplayFilter: Partial<IIssueDisplayFilterOptions>) => {
      if (!workspaceSlug || !projectId) return;
      updateFilters(workspaceSlug, projectId, EIssueFilterType.DISPLAY_FILTERS, updatedDisplayFilter);
    },
    [workspaceSlug, projectId, updateFilters]
  );

  const handleDisplayProperties = useCallback(
    (property: Partial<IIssueDisplayProperties>) => {
      if (!workspaceSlug || !projectId) return;
      updateFilters(workspaceSlug, projectId, EIssueFilterType.DISPLAY_PROPERTIES, property);
    },
    [workspaceSlug, projectId, updateFilters]
  );

  return (
    <>
      <WorkItemsModal
        isOpen={analyticsModal}
        onClose={() => setAnalyticsModal(false)}
        projectDetails={currentProjectDetails ?? undefined}
      />
      <div className="z-[13] flex items-center gap-2 border-b border-subtle bg-surface-1 px-4 py-2 md:hidden">
        <MobileLayoutSelection
          activeLayout={activeLayout}
          layouts={[EIssueLayoutTypes.LIST, EIssueLayoutTypes.KANBAN, EIssueLayoutTypes.CALENDAR]}
          onChange={handleLayoutChange}
        />
        <FiltersDropdown
          title={t("common.display")}
          placement="bottom-end"
          menuButton={
            <span className="flex items-center gap-1.5">
              <SlidersHorizontal aria-hidden="true" className="size-3.5" />
              {t("common.display")}
            </span>
          }
        >
          <DisplayFiltersSelection
            layoutDisplayFiltersOptions={
              activeLayout ? ISSUE_DISPLAY_FILTERS_BY_PAGE.issues.layoutOptions[activeLayout] : undefined
            }
            displayFilters={issueFilters?.displayFilters ?? {}}
            handleDisplayFiltersUpdate={handleDisplayFilters}
            displayProperties={issueFilters?.displayProperties ?? {}}
            handleDisplayPropertiesUpdate={handleDisplayProperties}
            cycleViewDisabled={!currentProjectDetails?.cycle_view}
            moduleViewDisabled={!currentProjectDetails?.module_view}
          />
        </FiltersDropdown>
        <Button
          variant="secondary"
          size="lg"
          className="ml-auto px-2"
          aria-label={t("common.analytics")}
          onClick={() => setAnalyticsModal(true)}
        >
          <ChartNoAxesColumn aria-hidden="true" className="size-3.5" />
        </Button>
      </div>
    </>
  );
});
