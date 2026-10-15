/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

type TProjectDetailsGate = {
  isParentLoading: boolean;
  isProjectDetailsLoading: boolean;
  hasProjectDetailsError: boolean;
  /** The workspace project list already put this project in the store. */
  isProjectInStore: boolean;
  /** The role from the workspace's project-roles fetch already grants access. */
  hasPermissionToCurrentProject: boolean;
};

/**
 * Whether the project wrapper must hold its children until the project details request settles.
 *
 * The details request only refreshes a project the workspace list already loaded, so a project
 * that is in the store and that the user may open renders at once, and its pages start their
 * own fetches beside the details request instead of after it. Without that proof the wrapper
 * waits as before, so the access screen is only ever decided on settled data.
 */
export function shouldWaitForProjectDetails(gate: TProjectDetailsGate): boolean {
  if (gate.isParentLoading) return true;
  if (!gate.isProjectDetailsLoading || gate.hasProjectDetailsError) return false;
  return !(gate.isProjectInStore && gate.hasPermissionToCurrentProject);
}
