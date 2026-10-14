/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useParams } from "next/navigation";
import useSWR from "swr";
import {
  EUserPermissions,
  EUserPermissionsLevel,
  WORKSPACE_MEMBERS,
  WORKSPACE_PARTIAL_PROJECTS,
  WORKSPACE_MEMBER_ME_INFORMATION,
  WORKSPACE_PROJECTS_ROLES_INFORMATION,
  WORKSPACE_FAVORITE,
  WORKSPACE_STATES,
  WORKSPACE_SIDEBAR_PREFERENCES,
  WORKSPACE_PROJECT_NAVIGATION_PREFERENCES,
} from "@plane/constants";
// hooks
import { useFavorite } from "@/hooks/store/use-favorite";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUserPermissions } from "@/hooks/store/user";

const SWR_OPTIONS = { revalidateIfStale: false, revalidateOnFocus: false };

/** A disabled fetch passes a null key and fetcher, so SWR skips it. */
function useWorkspaceFetch(enabled: boolean, key: string, fetcher: () => Promise<unknown>) {
  useSWR(enabled ? key : null, enabled ? fetcher : null, SWR_OPTIONS);
}

/**
 * Resolves the current workspace for the route slug and loads everything the
 * workspace shell needs (membership, permissions, projects, members, favorites,
 * states and navigation preferences).
 */
export function useWorkspaceAuthData() {
  // router params
  const { workspaceSlug } = useParams();
  // store hooks
  const { fetchPartialProjects } = useProject();
  const { fetchFavorite } = useFavorite();
  const {
    workspace: { fetchWorkspaceMembers },
  } = useMember();
  const { workspaces, fetchSidebarNavigationPreferences, fetchProjectNavigationPreferences } = useWorkspace();
  const { loader, workspaceInfoBySlug, fetchUserWorkspaceInfo, fetchUserProjectPermissions, allowPermissions } =
    useUserPermissions();
  const { fetchWorkspaceStates } = useProjectState();
  // derived values
  const canPerformWorkspaceMemberActions = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );
  const allWorkspaces = workspaces ? Object.values(workspaces) : undefined;
  const currentWorkspace =
    (allWorkspaces && allWorkspaces.find((workspace) => workspace?.slug === workspaceSlug)) || undefined;
  const currentWorkspaceInfo = workspaceSlug && workspaceInfoBySlug(workspaceSlug.toString());

  const slug = workspaceSlug?.toString() ?? "";
  const hasSlug = !!workspaceSlug;
  const hasWorkspace = hasSlug && !!currentWorkspace;
  const canFetchFavorites = hasWorkspace && canPerformWorkspaceMemberActions;

  // fetching user workspace information
  useWorkspaceFetch(hasWorkspace, WORKSPACE_MEMBER_ME_INFORMATION(slug), () => fetchUserWorkspaceInfo(slug));
  useWorkspaceFetch(hasWorkspace, WORKSPACE_PROJECTS_ROLES_INFORMATION(slug), () => fetchUserProjectPermissions(slug));
  // fetching workspace projects
  useWorkspaceFetch(hasWorkspace, WORKSPACE_PARTIAL_PROJECTS(slug), () => fetchPartialProjects(slug));
  // fetch workspace members
  useWorkspaceFetch(hasWorkspace, WORKSPACE_MEMBERS(slug), () => fetchWorkspaceMembers(slug));
  // fetch workspace favorite
  useWorkspaceFetch(canFetchFavorites, WORKSPACE_FAVORITE(slug), () => fetchFavorite(slug));
  // fetch workspace states
  useWorkspaceFetch(hasSlug, WORKSPACE_STATES(slug), () => fetchWorkspaceStates(slug));
  // fetch workspace sidebar preferences
  useWorkspaceFetch(hasSlug, WORKSPACE_SIDEBAR_PREFERENCES(slug), () => fetchSidebarNavigationPreferences(slug));
  // fetch workspace project navigation preferences
  useWorkspaceFetch(hasSlug, WORKSPACE_PROJECT_NAVIGATION_PREFERENCES(slug), () =>
    fetchProjectNavigationPreferences(slug)
  );

  return { loader, allWorkspaces, currentWorkspace, currentWorkspaceInfo };
}
