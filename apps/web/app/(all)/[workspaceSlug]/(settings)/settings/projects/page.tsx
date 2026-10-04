/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useContext, useEffect } from "react";
import { Navigate, useOutletContext } from "react-router";
import { usePaginatedQuery } from "convex/react";
import { api } from "@summon/convex/api";
import Link from "next/link";
import { useTheme } from "next-themes";
// plane imports
import { PROJECT_TRACKER_ELEMENTS } from "@plane/constants";
import { Button, getButtonStyling } from "@plane/propel/button";
import { cn } from "@plane/utils";
// assets
import ProjectDarkEmptyState from "@/app/assets/empty-state/project-settings/no-projects-dark.png?url";
import ProjectLightEmptyState from "@/app/assets/empty-state/project-settings/no-projects-light.png?url";
// hooks
import { LogoSpinner } from "@/components/common/logo-spinner";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import { NativeProjectCreateContext } from "@/components/workspace/native-shell/session";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { useStickiesCommands } from "@/components/stickies/native/provider";

function ProjectSettingsPage() {
  const session = useOutletContext<WorkspaceSession>();
  const createProject = useContext(NativeProjectCreateContext);
  const sticky = useStickiesCommands();
  const { resolvedTheme } = useTheme();
  const { results, status, loadMore } = usePaginatedQuery(
    api.projects.order.list,
    { workspaceId: session.workspace._id },
    { initialNumItems: 1 }
  );
  const first = results[0];
  useEffect(() => {
    if (!first && status === "CanLoadMore") loadMore(1);
  }, [first, status, loadMore]);
  // derived values
  const resolvedPath = resolvedTheme === "dark" ? ProjectDarkEmptyState : ProjectLightEmptyState;
  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={sticky.create}
      onOpenStickies={sticky.openAll}
      beforeLeave={sticky.flushAll}
    >
      {first ? (
        <Navigate to={`/${session.workspace.slug}/settings/projects/${first._id}`} />
      ) : status !== "Exhausted" ? (
        <div role="status" aria-label="Loading projects" className="grid h-full place-items-center p-4">
          <LogoSpinner />
        </div>
      ) : (
        <div className="mx-auto flex h-full max-w-[480px] flex-col items-center justify-center gap-4 px-page-x">
          <img src={resolvedPath} alt="No projects yet" />
          <div className="text-16 font-semibold text-tertiary">No projects yet</div>
          <div className="text-center text-13 text-tertiary">
            Projects act as the foundation for goal-driven work. They let you manage your teams, tasks, and everything
            you need to get things done.
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="https://plane.so/" target="_blank" className={cn(getButtonStyling("secondary", "base"))}>
              Learn more about projects
            </Link>
            <Button
              onClick={createProject ?? undefined}
              disabled={!createProject}
              data-ph-element={PROJECT_TRACKER_ELEMENTS.EMPTY_STATE_CREATE_PROJECT_BUTTON}
            >
              Start your first project
            </Button>
          </div>
        </div>
      )}
    </PreservedWorkspaceShell>
  );
}

export default ProjectSettingsPage;
