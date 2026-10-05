/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback } from "react";
import { api } from "@summon/convex/api";
import type { FunctionArgs } from "convex/server";
import AnalyticsWrapper, {
  AnalyticsError,
  readTasks,
  readProjects,
  useAnalyticsReport,
  type AnalyticsScope,
} from "../analytics-wrapper";
import { readReportPages } from "@/components/convex-core/reporting/pages";
import TotalInsights from "../total-insights";
import ActiveProjects from "./active-projects";
import ProjectInsights from "./project-insights";
export function Overview({ scope, generation }: { scope: AnalyticsScope; generation: number }) {
  const read = useCallback(
    async (client: Parameters<typeof readTasks>[0], signal: AbortSignal) => {
      const [tasks, projects, people, workspacePeople, active, ...entities] = await Promise.all([
        readTasks(client, scope, signal),
        readProjects(client, scope.workspaceId, signal),
        readReportPages(
          (cursor) =>
            client.query(api.reporting.analytics.people, {
              scope,
              workspaceWide: false,
              paginationOpts: { cursor, numItems: 100 },
            }),
          signal,
          () => {}
        ),
        readReportPages(
          (cursor) =>
            client.query(api.reporting.analytics.people, {
              scope,
              workspaceWide: true,
              paginationOpts: { cursor, numItems: 100 },
            }),
          signal,
          () => {}
        ),
        readReportPages(
          (cursor) =>
            client.query(api.reporting.analytics.activeProjects, {
              workspaceId: scope.workspaceId,
              paginationOpts: { cursor, numItems: 100 },
            }),
          signal,
          () => {}
        ),
        ...(
          ["projects", "cycles", "modules", "intake", "pages", "views"] satisfies FunctionArgs<
            typeof api.reporting.analytics.entities
          >["cohort"][]
        ).map((cohort) =>
          readReportPages(
            (cursor) =>
              client.query(api.reporting.analytics.entities, {
                scope,
                cohort,
                paginationOpts: { cursor, numItems: 100 },
              }),
            signal,
            () => {}
          )
        ),
      ]);
      const peopleCount = people.reduce(
        (sum, page) => ({
          total: sum.total + page.total,
          admin: sum.admin + page.admin,
          member: sum.member + page.member,
          guest: sum.guest + page.guest,
        }),
        { total: 0, admin: 0, member: 0, guest: 0 }
      );
      const totals = entities.map((pages) => pages.reduce((a, b) => a + b, 0));
      const activeCounts = new Map<string, { total: number; completed: number }>();
      for (const page of active)
        for (const row of page) {
          const previous = activeCounts.get(row.id);
          activeCounts.set(row.id, {
            total: row.total + (previous?.total ?? 0),
            completed: row.completed + (previous?.completed ?? 0),
          });
        }
      return {
        tasks,
        people: peopleCount,
        projects: totals[0],
        cycles: totals[1],
        intake: totals[3],
        radar: [
          { key: "work_items", name: "Work items", count: tasks.counts.total },
          { key: "cycles", name: "Cycles", count: totals[1] },
          { key: "modules", name: "Modules", count: totals[2] },
          { key: "intake", name: "Intake", count: totals[3] },
          { key: "members", name: "Members", count: workspacePeople.reduce((sum, p) => sum + p.total, 0) },
          { key: "pages", name: "Pages", count: totals[4] },
          { key: "views", name: "Views", count: totals[5] },
        ],
        active: projects.map((project) => ({
          id: project.id,
          name: project.name,
          identifier: project.identifier,
          logo: project.logo,
          joined: project.joined,
          archived: project.archived,
          total: activeCounts.get(project.id)?.total ?? 0,
          completed: activeCounts.get(project.id)?.completed ?? 0,
        })),
      };
    },
    [scope]
  );
  const report = useAnalyticsReport(read, generation);
  return (
    <AnalyticsWrapper i18nTitle="common.overview">
      <AnalyticsError error={report.error} />
      {!report.error && (
        <div className="flex flex-col gap-14">
          <TotalInsights
            counts={report.data?.tasks.counts}
            overview={
              report.data
                ? {
                    projects: report.data.projects,
                    cycles: report.data.cycles,
                    intake: report.data.intake,
                    people: report.data.people,
                  }
                : { projects: 0, cycles: 0, intake: 0, people: { total: 0, admin: 0, member: 0, guest: 0 } }
            }
            isLoading={report.isLoading}
          />
          <div className="grid grid-cols-1 gap-14 md:grid-cols-5">
            <ProjectInsights data={report.data?.radar} isLoading={report.isLoading} />
            <ActiveProjects projects={report.data?.active} isLoading={report.isLoading} />
          </div>
        </div>
      )}
    </AnalyticsWrapper>
  );
}
