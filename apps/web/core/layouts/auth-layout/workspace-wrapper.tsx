/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { observer } from "mobx-react";
// local imports
import { useWorkspaceAuthData } from "./use-workspace-auth-data";
import { WorkspaceAuthLoader, WorkspaceNotAuthorized, WorkspaceNotFound } from "./workspace-auth-states";

interface IWorkspaceAuthWrapper {
  children: ReactNode;
  isLoading?: boolean;
}

export const WorkspaceAuthWrapper = observer(function WorkspaceAuthWrapper(props: IWorkspaceAuthWrapper) {
  const { children, isLoading: isParentLoading = false } = props;
  const { loader, allWorkspaces, currentWorkspace, currentWorkspaceInfo } = useWorkspaceAuthData();

  // if list of workspaces are not there then we have to render the spinner
  if (isParentLoading || allWorkspaces === undefined || loader) return <WorkspaceAuthLoader />;

  // if workspaces are there and we are trying to access the workspace that we are not part of then show the existing workspaces
  if (currentWorkspace === undefined && !currentWorkspaceInfo)
    return <WorkspaceNotFound allWorkspaces={allWorkspaces} />;

  // while user does not have access to view that workspace
  if (currentWorkspaceInfo === undefined) return <WorkspaceNotAuthorized />;

  return <>{children}</>;
});
