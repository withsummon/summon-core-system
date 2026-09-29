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
import { calculateIdentifierWidth } from "@/components/issues/issue-layouts/utils";
import { ListLayoutLoader } from "@/components/ui/loader/layouts/list-layout-loader";
import { taskStatusOptions } from "@/components/convex-core/tasks/options";
import { TaskPeek } from "@/components/convex-core/tasks/task-detail";
import { ProjectIssueRow } from "@/components/convex-core/tasks/lifecycle";

export default function ProjectIssuesPage() {
  const address = useOutletContext<FunctionReturnType<typeof api.navigation.address.resolveProjectId>>();
  // i18n
  const { t } = useTranslation();
  const { project, workspace } = address;
  const tasks = usePaginatedQuery(api.tasks.index.list, { projectId: project._id }, { initialNumItems: 50 });
  const states = useQuery(api.tasks.states.list, { projectId: project._id });
  return (
    <>
      <PageHead title={`${project.name} - ${t("issue.label", { count: 2 })}`} />
      <div className="relative flex h-full w-full flex-col bg-surface-1" aria-label="Project work items">
        {tasks.status === "LoadingFirstPage" ? (
          <ListLayoutLoader />
        ) : (
          <>
            {tasks.status === "Exhausted" && !tasks.results.length && (
              <EmptyStateCompact assetKey="work-item" title="No work items yet" assetClassName="size-20" />
            )}
            <ul className="divide-y divide-subtle">
              {tasks.results.map((task) => (
                <ProjectIssueRow
                  key={task._id}
                  task={task}
                  identifier={`${project.identifier}-${task.sequence}`}
                  identifierWidth={calculateIdentifierWidth(project.identifier.length, project.nextSequence)}
                  href={`/${workspace.slug}/browse/${project.identifier}-${task.sequence}/`}
                  stateName={
                    states?.find((state) => state._id === task.stateId)?.name ?? taskStatusOptions[task.status].label
                  }
                />
              ))}
            </ul>
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
