/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router";
import { useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
// i18n
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { PriorityIcon } from "@plane/propel/icons";
import { EmptyStateCompact } from "@plane/propel/empty-state";
// components
import { PageHead } from "@/components/core/page-title";
import { IssueListBlockView } from "@/components/issues/issue-layouts/list/block";
import { IdentifierText } from "@/components/issues/issue-detail/identifier-text";
import { calculateIdentifierWidth } from "@/components/issues/issue-layouts/utils";
import { ListLayoutLoader } from "@/components/ui/loader/layouts/list-layout-loader";
import { taskStatusOptions } from "@/components/convex-core/tasks/options";
import { renderFormattedDate } from "@plane/utils";
import { TaskPeek } from "@/components/convex-core/tasks/task-detail";
import { TaskLifecycle, useTaskLifecycle } from "@/components/convex-core/tasks/lifecycle";
import { Menu } from "@plane/propel/menu";
import { usePlatformOS } from "@/hooks/use-platform-os";

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

function ProjectIssueRow({
  task,
  identifier,
  identifierWidth,
  href,
  stateName,
}: {
  task: FunctionReturnType<typeof api.tasks.index.list>["page"][number];
  identifier: string;
  identifierWidth: number;
  href: string;
  stateName: string;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { isMobile } = usePlatformOS();
  const lifecycle = useTaskLifecycle(() => {});
  const peeked = params.get("peek") === identifier;
  return (
    <li>
      <IssueListBlockView
        issueId={task._id}
        href={href}
        name={task.title}
        ariaLabel={`${identifier}: ${task.title}`}
        onOpen={() => {
          if (isMobile) navigate(href);
          else
            setParams((current) => {
              const next = new URLSearchParams(current);
              next.set("peek", identifier);
              return next;
            });
        }}
        rowRef={rowRef}
        onDragStart={undefined}
        isPeeked={peeked}
        isPeekedAtCurrentLevel={peeked}
        isActive={false}
        isSelected={false}
        isDragging={false}
        disabled={false}
        pending={lifecycle.pending}
        identifier={<IdentifierText identifier={identifier} minWidth={identifierWidth} size="sm" />}
        indent={0}
        selection={null}
        expansion={null}
        properties={
          <>
            <span className="rounded-sm border border-subtle px-2 py-0.5 text-caption-sm-regular">{stateName}</span>
            <span className="inline-flex items-center gap-1 rounded-sm border border-subtle px-2 py-0.5 text-caption-sm-regular capitalize">
              <PriorityIcon priority={task.priority} className="size-3.5" />
              {task.priority}
            </span>
            {task.targetDate && (
              <span className="text-caption-sm-regular text-secondary">{renderFormattedDate(task.targetDate)}</span>
            )}
          </>
        }
        actions={() => (
          <TaskLifecycle task={task} disabled={false} lifecycle={lifecycle}>
            <Menu.MenuItem onClick={() => window.open(href, "_blank", "noopener,noreferrer")}>
              Open in new tab
            </Menu.MenuItem>
          </TaskLifecycle>
        )}
      />
    </li>
  );
}
