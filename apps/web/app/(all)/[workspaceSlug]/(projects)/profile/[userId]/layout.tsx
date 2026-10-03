/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { useEffect, useState } from "react";
import { Outlet, useLocation, useOutletContext } from "react-router";
import { useQuery } from "convex/react";
import { observer } from "mobx-react";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { PROFILE_VIEWER_TAB, PROFILE_ADMINS_TAB } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { AppHeader } from "@/components/core/app-header";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { ProfileSidebar } from "@/components/profile/sidebar";
import { ProfileIssuesFilter, useProfileTaskControls } from "@/components/profile/profile-issues-filter";
import type { ProfileSummary } from "@/components/profile/overview/stats";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import type { WorkspaceSession } from "@/app/native-workspace";
import type { Route } from "./+types/layout";
import { UserProfileHeader } from "./header";
import { ProfileNavbar } from "./navbar";

// Route context carries the generated owner result and the native query state.
export type ProfileSession = WorkspaceSession & {
  subject: FunctionReturnType<typeof api.tasks.profile.subject>;
  summary: ProfileSummary;
  taskControls: ReturnType<typeof useProfileTaskControls>;
};

export default observer(function ProfileLayout({ params }: Route.ComponentProps) {
  const session = useOutletContext<WorkspaceSession>();
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const commands = useStickiesCommands();
  const [collapsed, setCollapsed] = useState(true);
  const taskControls = useProfileTaskControls(session.workspace._id, session.workspace.slug);
  const subject = useQuery(api.tasks.profile.subject, {
    workspaceId: session.workspace._id,
    userId: params.userId,
  });
  const contributions = usePaginatedQuery(
    api.tasks.profile.summary,
    subject ? { workspaceId: session.workspace._id, userId: subject.userId } : "skip",
    { initialNumItems: 100 }
  );
  const { status, loadMore } = contributions;
  useEffect(() => {
    if (status === "CanLoadMore") loadMore(100);
  }, [status, loadMore]);
  const projects = new Map<ProfileSummary["results"][number]["projectId"], ProfileSummary["results"][number]>();
  for (const contribution of contributions.results) {
    const project = projects.get(contribution.projectId);
    if (!project) {
      projects.set(contribution.projectId, {
        ...contribution,
        statusDistribution: contribution.statusDistribution.map((item) => ({ ...item })),
        priorityDistribution: contribution.priorityDistribution.map((item) => ({ ...item })),
      });
      continue;
    }
    project.createdCount += contribution.createdCount;
    project.assignedCount += contribution.assignedCount;
    project.subscribedCount += contribution.subscribedCount;
    project.completedByTimestamp += contribution.completedByTimestamp;
    project.completedCount += contribution.completedCount;
    project.pendingCount += contribution.pendingCount;
    project.statusDistribution.forEach((item) => {
      item.count += contribution.statusDistribution.reduce(
        (total, next) => total + (next.status === item.status ? next.count : 0),
        0
      );
    });
    project.priorityDistribution.forEach((item) => {
      item.count += contribution.priorityDistribution.reduce(
        (total, next) => total + (next.priority === item.priority ? next.count : 0),
        0
      );
    });
  }
  const summary = { ...contributions, results: [...projects.values()] };
  const prefix = `/${session.workspace.slug}/profile/${params.userId}`;
  const activeTab = [...PROFILE_VIEWER_TAB, ...PROFILE_ADMINS_TAB].find(
    (tab) => pathname.replace(/\/$/, "") === `${prefix}${tab.selected}`.replace(/\/$/, "")
  );
  const context = subject ? { ...session, subject, summary, taskControls } : undefined;
  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
      {!context ? (
        <p role="status" className="p-6">
          {t("loading")}
        </p>
      ) : !activeTab ? (
        <p role="alert" className="p-6">
          Profile view not found.
        </p>
      ) : (
        <div className="flex size-full min-h-0 min-w-0 overflow-hidden md:flex-row">
          <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
            <AppHeader
              header={
                <UserProfileHeader
                  workspaceSlug={session.workspace.slug}
                  subject={context.subject}
                  activeTab={activeTab}
                  collapsed={collapsed}
                  onToggle={() => setCollapsed((value) => !value)}
                  filters={
                    activeTab.key !== "summary" && activeTab.key !== "activity" && context.subject.canViewTaskTabs ? (
                      <ProfileIssuesFilter controls={taskControls} />
                    ) : undefined
                  }
                />
              }
            />
            <ContentWrapper>
              <div className="flex size-full flex-col overflow-hidden">
                <ProfileNavbar workspaceSlug={session.workspace.slug} subject={context.subject} activeTab={activeTab} />
                {context.subject.canViewTaskTabs || activeTab.key === "summary" ? (
                  <div className="h-full w-full overflow-hidden">
                    <Outlet context={context} />
                  </div>
                ) : (
                  <div className="grid size-full place-items-center text-secondary">
                    {t("you_do_not_have_the_permission_to_access_this_page")}
                  </div>
                )}
              </div>
            </ContentWrapper>
          </div>
          <ProfileSidebar
            subject={context.subject}
            summary={summary}
            collapsed={collapsed}
            onClose={() => setCollapsed(true)}
          />
        </div>
      )}
    </PreservedWorkspaceShell>
  );
});
