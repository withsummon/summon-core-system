/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
// hooks
import { useUser, useUserPermissions } from "@/hooks/store/user";
// store
import type { IInboxIssueStore } from "@/store/inbox/inbox-issue.store";

/** Which intake actions the current user may take on this work item. */
export function useInboxIssuePermissions(
  workspaceSlug: string,
  projectId: string,
  inboxIssue: IInboxIssueStore | undefined
) {
  const { data: currentUser } = useUser();
  const { allowPermissions } = useUserPermissions();

  const isAllowed = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug,
    projectId
  );
  const isProjectAdmin = allowPermissions(
    [EUserPermissions.ADMIN],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug,
    projectId
  );
  // pending (0) and snoozed (-2) items can still be triaged
  const isPending = inboxIssue?.status === 0 || inboxIssue?.status === -2;
  const canTriage = isAllowed && isPending;

  return {
    isAllowed,
    isProjectAdmin,
    canMarkAsDuplicate: canTriage,
    canMarkAsAccepted: canTriage,
    canMarkAsDeclined: canTriage,
    // can delete only if admin or is creator of the issue
    canDelete: isProjectAdmin || inboxIssue?.issue?.created_by === currentUser?.id,
    isAcceptedOrDeclined: inboxIssue?.status ? [-1, 1, 2].includes(inboxIssue.status) : undefined,
  };
}
