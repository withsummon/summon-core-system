/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { ENotificationLoader, ENotificationQueryParamType } from "@plane/constants";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import { cn } from "@plane/utils";
// components
import { LogoSpinner } from "@/components/common/logo-spinner";
// hooks
import { useWorkspaceNotifications } from "@/hooks/store/notifications";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUserPermissions } from "@/hooks/store/user";
import { useWorkspaceIssueProperties } from "@/hooks/use-workspace-issue-properties";
import { useNotificationPreview } from "@/hooks/use-notification-preview";
// local imports
import { InboxContentRoot } from "../inbox/content";

type NotificationsRootProps = {
  workspaceSlug?: string;
};

function useWorkspaceNotificationsFetch() {
  const { currentWorkspace } = useWorkspace();
  const { notificationIdsByWorkspaceId, getNotifications } = useWorkspaceNotifications();
  const hasNotifications = !!(currentWorkspace && notificationIdsByWorkspaceId(currentWorkspace.id));
  const notificationMutation = hasNotifications ? ENotificationLoader.MUTATION_LOADER : ENotificationLoader.INIT_LOADER;
  const notificationLoader = hasNotifications ? ENotificationQueryParamType.CURRENT : ENotificationQueryParamType.INIT;
  const workspaceSlug = currentWorkspace?.slug;
  useSWR(
    workspaceSlug ? `WORKSPACE_NOTIFICATION_${workspaceSlug}` : null,
    workspaceSlug ? () => getNotifications(workspaceSlug, notificationMutation, notificationLoader) : null
  );
}

function useProjectMemberInfoLoading(workspaceSlug?: string, projectId?: string, isInboxIssue?: boolean) {
  const { fetchUserProjectInfo } = useUserPermissions();
  const shouldFetch = !!(workspaceSlug && projectId && isInboxIssue);
  const { isLoading } = useSWR(
    shouldFetch ? `PROJECT_MEMBER_PERMISSION_INFO_${workspaceSlug}_${projectId}` : null,
    shouldFetch ? () => fetchUserProjectInfo(workspaceSlug, projectId) : null
  );
  return isLoading;
}

export const NotificationsRoot = observer(function NotificationsRoot({ workspaceSlug }: NotificationsRootProps) {
  // hooks
  const { currentSelectedNotificationId, setCurrentSelectedNotificationId, notificationLiteByNotificationId } =
    useWorkspaceNotifications();
  const { isWorkItem, PeekOverviewComponent, setPeekWorkItem } = useNotificationPreview();
  // derived values
  const { workspace_slug, project_id, issue_id, is_inbox_issue } =
    notificationLiteByNotificationId(currentSelectedNotificationId);
  const inboxIssue =
    is_inbox_issue === true && workspace_slug && project_id && issue_id
      ? { workspaceSlug: workspace_slug, projectId: project_id, issueId: issue_id }
      : undefined;

  // fetching workspace work item properties
  useWorkspaceIssueProperties(workspaceSlug);
  // fetch workspace notifications
  useWorkspaceNotificationsFetch();
  // fetching user project member info
  const projectMemberInfoLoader = useProjectMemberInfoLoading(workspace_slug, project_id, is_inbox_issue);

  const embedRemoveCurrentNotification = useCallback(
    () => setCurrentSelectedNotificationId(undefined),
    [setCurrentSelectedNotificationId]
  );

  // clearing up the selected notifications when unmounting the page
  useEffect(
    () => () => {
      setPeekWorkItem(undefined);
    },
    [setCurrentSelectedNotificationId, setPeekWorkItem]
  );

  const renderContent = () => {
    if (!currentSelectedNotificationId)
      return (
        <div className="flex size-full items-center justify-center">
          <EmptyStateCompact assetKey="unknown" assetClassName="size-20" />
        </div>
      );
    if (!inboxIssue)
      return <PeekOverviewComponent embedIssue embedRemoveCurrentNotification={embedRemoveCurrentNotification} />;
    if (projectMemberInfoLoader)
      return (
        <div className="flex h-full w-full items-center justify-center">
          <LogoSpinner />
        </div>
      );
    return (
      <InboxContentRoot
        setIsMobileSidebar={() => {}}
        isMobileSidebar={false}
        workspaceSlug={inboxIssue.workspaceSlug}
        projectId={inboxIssue.projectId}
        inboxIssueId={inboxIssue.issueId}
        isNotificationEmbed
        embedRemoveCurrentNotification={embedRemoveCurrentNotification}
      />
    );
  };

  return <div className={cn("h-full w-full overflow-hidden", isWorkItem && "overflow-y-auto")}>{renderContent()}</div>;
});
