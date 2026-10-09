/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useOutletContext } from "react-router";
import { useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
// i18n
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { EmptyStateCompact } from "@plane/propel/empty-state";
// components
import { PageHead } from "@/components/core/page-title";
import { ListLayoutLoader } from "@/components/ui/loader/layouts/list-layout-loader";
import { TaskPeek } from "@/components/convex-core/tasks/task-detail";
import { ProjectViewLayoutRoot } from "@/components/issues/issue-layouts/roots/project-view-layout-root";

export default function ProjectIssuesPage() {
  const address = useOutletContext<FunctionReturnType<typeof api.navigation.address.resolveProjectId>>();
  // i18n
  const { t } = useTranslation();
  const { project, workspace } = address;
  const preferences = useQuery(api.projects.navigation.getTaskPreferences, { projectId: project._id });
  const tasks = usePaginatedQuery(
    api.tasks.index.list,
    preferences
      ? {
          projectId: project._id,
          filters: preferences.filters,
          order: preferences.displayFilters.order,
          includeSubtasks: preferences.displayFilters.includeSubtasks,
        }
      : "skip",
    { initialNumItems: 50 }
  );
  return (
    <>
      <PageHead title={`${project.name} - ${t("issue.label", { count: 2 })}`} />
      <div className="relative flex h-full w-full flex-col bg-surface-1" aria-label="Project work items">
        {!preferences || tasks.status === "LoadingFirstPage" ? (
          <ListLayoutLoader />
        ) : (
          <>
            {tasks.status === "Exhausted" && !tasks.results.length && (
              <EmptyStateCompact assetKey="work-item" title="No work items yet" assetClassName="size-20" />
            )}
            <ProjectViewLayoutRoot
              tasks={tasks.results}
              address={address}
              displayFilters={preferences.displayFilters}
              displayProperties={preferences.displayProperties}
              cohortComplete={tasks.status === "Exhausted"}
            />
          </>
        )}
        {tasks.status === "CanLoadMore" && (
          <Button className="m-4 self-start" variant="secondary" onClick={() => tasks.loadMore(50)}>
            Load more work items
          </Button>
        )}
        {tasks.status === "LoadingMore" && (
          <p role="status" className="p-4">
            Loading more work items…
          </p>
        )}
      </div>
      <TaskPeek workspaceSlug={workspace.slug} />
    </>
  );
}
