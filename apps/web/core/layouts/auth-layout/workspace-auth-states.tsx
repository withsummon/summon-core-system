/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { getButtonStyling } from "@plane/propel/button";
import { PlaneLogo } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Tooltip } from "@plane/propel/tooltip";
import type { IWorkspace } from "@plane/types";
import { cn } from "@plane/utils";
// assets
import WorkSpaceNotAvailable from "@/app/assets/workspace/workspace-not-available.png?url";
// components
import { LogoSpinner } from "@/components/common/logo-spinner";
// hooks
import { useUser } from "@/hooks/store/user";
import { usePlatformOS } from "@/hooks/use-platform-os";

export function WorkspaceAuthLoader() {
  return (
    <div className="grid h-full place-items-center rounded-lg border border-subtle p-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <LogoSpinner />
      </div>
    </div>
  );
}

type TWorkspaceNotFoundProps = {
  allWorkspaces: IWorkspace[];
};

export const WorkspaceNotFound = observer(function WorkspaceNotFound(props: TWorkspaceNotFoundProps) {
  const { allWorkspaces } = props;
  const { signOut, data: currentUser } = useUser();
  const { isMobile } = usePlatformOS();
  const hasWorkspaces = allWorkspaces.length > 0;

  const handleSignOut = async () => {
    await signOut().catch(() =>
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "Failed to sign out. Please try again.",
      })
    );
  };

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center bg-surface-2">
      <div className="relative container mx-auto flex h-full w-full flex-col overflow-hidden overflow-y-auto px-5 py-14 md:px-0">
        <div className="relative flex flex-shrink-0 items-center justify-between gap-4">
          <div className="z-10 flex-shrink-0 bg-surface-2 py-4">
            <PlaneLogo className="h-9 w-auto text-primary" />
          </div>
          <div className="relative flex items-center gap-2">
            <div className="text-13 font-medium">{currentUser?.email}</div>
            <button
              type="button"
              aria-label="Sign out"
              className="relative flex h-6 w-6 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-sm hover:bg-layer-1"
              onClick={handleSignOut}
            >
              <Tooltip tooltipContent={"Sign out"} position="top" className="ml-2" isMobile={isMobile}>
                <LogOut size={14} />
              </Tooltip>
            </button>
          </div>
        </div>
        <div className="relative flex h-full w-full flex-grow flex-col items-center justify-center space-y-3">
          <div className="relative flex-shrink-0">
            <img src={WorkSpaceNotAvailable} className="h-[220px] object-contain object-center" alt="Plane logo" />
          </div>
          <h3 className="text-center text-16 font-semibold">Workspace not found</h3>
          <p className="text-center text-13 text-secondary">
            No workspace found with the URL. It may not exist or you lack authorization to view it.
          </p>
          <div className="flex items-center justify-center gap-2 pt-4">
            {hasWorkspaces && (
              <Link href="/" className={cn(getButtonStyling("primary", "base"))}>
                Go Home
              </Link>
            )}
            {hasWorkspaces && (
              <Link href="/settings/profile/general/" className={cn(getButtonStyling("secondary", "base"))}>
                Visit Profile
              </Link>
            )}
            {!hasWorkspaces && (
              <Link href="/create-workspace/" className={cn(getButtonStyling("secondary", "base"))}>
                Create new workspace
              </Link>
            )}
          </div>
        </div>

        <div className="absolute top-0 bottom-0 left-4 w-0 bg-layer-1 md:w-0.5" />
      </div>
    </div>
  );
});

/** Same screen as the standalone not-a-member view. */
export { NotAWorkspaceMember as WorkspaceNotAuthorized } from "@/components/auth-screens/workspace/not-a-member";
