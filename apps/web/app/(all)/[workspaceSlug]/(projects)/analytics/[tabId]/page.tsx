/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { Tabs } from "@plane/propel/tabs";
import { EmptyStateDetailed } from "@plane/propel/empty-state";
import type { Id } from "@summon/convex/data-model";
import { NativeProjectCreateContext, type WorkspaceSession } from "@/components/workspace/native-shell/session";
import { PageHead } from "@/components/core/page-title";
import AnalyticsFilterActions from "@/components/analytics/analytics-filter-actions";
import { AnalyticsError, readProjects, useAnalyticsReport } from "@/components/analytics/analytics-wrapper";
import { Overview } from "@/components/analytics/overview";
import { WorkItems } from "@/components/analytics/work-items";
import type { Route } from "./+types/page";
export default function AnalyticsPage({ params }: Route.ComponentProps) {
  const session = useOutletContext<WorkspaceSession>();
  const create = useContext(NativeProjectCreateContext);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    const refresh = () => setGeneration((current) => current + 1);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, []);
  const [selected, setSelected] = useState<Id<"projects">[]>([]);
  const read = useCallback(
    (client: Parameters<typeof readProjects>[0], signal: AbortSignal) =>
      readProjects(client, session.workspace._id, signal),
    [session.workspace._id]
  );
  const report = useAnalyticsReport(read, JSON.stringify([generation, session.workspace.membershipRole]));
  const projects = report.data?.filter((project) => project.joined && !project.archived);
  const scope = useMemo(
    () => ({ workspaceId: session.workspace._id, projectIds: selected, focus: null }),
    [session.workspace._id, selected]
  );
  const tab = params.tabId === "work-items" ? "work-items" : "overview";
  return (
    <>
      <PageHead title={t("workspace_analytics.page_label", { workspace: session.workspace.name })} />
      <AnalyticsError error={report.error} />
      {report.data && !report.data.some((project) => !project.archived) ? (
        <EmptyStateDetailed
          assetKey="project"
          title={t("workspace_projects.empty_state.no_projects.title")}
          description={t("workspace_projects.empty_state.no_projects.description")}
          actions={[
            { label: "Create a project", onClick: () => create?.(), disabled: !create },
            { label: "Refresh analytics", onClick: () => setGeneration((current) => current + 1) },
          ]}
        />
      ) : (
        <Tabs
          value={tab}
          onValueChange={(value) => navigate(`/${session.workspace.slug}/analytics/${value}`)}
          className="h-full w-full"
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-subtle bg-surface-1 px-6 py-2">
              <Tabs.List className="h-7 w-fit">
                <Tabs.Trigger value="overview" size="md">
                  {t("common.overview")}
                </Tabs.Trigger>
                <Tabs.Trigger value="work-items" size="md">
                  {t("sidebar.work_items")}
                </Tabs.Trigger>
              </Tabs.List>
              <div className="flex flex-wrap items-center gap-2">
                {projects && <AnalyticsFilterActions projects={projects} value={selected} onChange={setSelected} />}
                <Button variant="secondary" size="sm" onClick={() => setGeneration((current) => current + 1)}>
                  Refresh analytics
                </Button>
              </div>
            </div>
            <p role="status" className="px-6 py-2 text-12 text-secondary">
              {report.isLoading
                ? "Loading project choices…"
                : "Paginated report · Refresh for updated results. Changes during loading may affect totals."}
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {tab === "overview" ? (
                <Overview
                  key={JSON.stringify([scope, session.workspace.membershipRole])}
                  scope={scope}
                  generation={generation}
                />
              ) : (
                <WorkItems
                  key={JSON.stringify([scope, session.workspace.membershipRole])}
                  scope={scope}
                  generation={generation}
                  workspaceSlug={session.workspace.slug}
                />
              )}
            </div>
          </div>
        </Tabs>
      )}
    </>
  );
}
