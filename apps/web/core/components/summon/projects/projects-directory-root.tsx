/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useContext, useEffect } from "react";
import { useOutletContext } from "react-router";
import { useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import { api } from "@summon/convex/api";
import type { FunctionReturnType } from "convex/server";
import { NativeProjectCreateContext, type WorkspaceSession } from "@/components/workspace/native-shell/session";
import { SummonRequestState } from "@/components/summon/request-state";
import { ProjectsPortfolio } from "./projects-portfolio";
export function ProjectsDirectoryRoot({ workspaceSlug }: { workspaceSlug: string }) {
  const { workspace } = useOutletContext<WorkspaceSession>();
  const createProject = useContext(NativeProjectCreateContext);
  const projects = useQuery(api.projects.index.list, { workspaceId: workspace._id });
  const totals = usePaginatedQuery(
    api.reporting.tasks.page,
    {
      scope: {
        workspaceId: workspace._id,
        projectId: null,
        clientId: null,
        dateFrom: null,
        dateTo: null,
        today: new Date().toLocaleDateString("en-CA"),
      },
    },
    { initialNumItems: 100 }
  );
  const { status: totalsStatus, loadMore: loadTotals } = totals;
  useEffect(() => {
    if (totalsStatus === "CanLoadMore") loadTotals(100);
  }, [totalsStatus, loadTotals]);
  const progress: FunctionReturnType<typeof api.reporting.tasks.page>["contribution"]["projects"] = {};
  for (const page of totals.results)
    for (const [id, counts] of Object.entries(page.projects)) {
      const previous = progress[id] ?? { total: 0, completed: 0 };
      progress[id] = { total: previous.total + counts.total, completed: previous.completed + counts.completed };
    }
  if (!projects) return <SummonRequestState loading />;
  return (
    <ProjectsPortfolio
      workspaceSlug={workspaceSlug}
      allProjects={projects}
      progress={progress}
      totalsReady={totals.status === "Exhausted"}
      onCreateProject={createProject}
    />
  );
}
