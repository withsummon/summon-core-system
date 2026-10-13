/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type React from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArchiveRestoreIcon, Settings, UserPlus } from "lucide-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel, IS_FAVORITE_MENU_OPEN } from "@plane/constants";
import { useLocalStorage } from "@plane/hooks";
import { Button } from "@plane/propel/button";
import { CheckIcon, LinkIcon, NewTabIcon, TrashIcon } from "@plane/propel/icons";
import { setPromiseToast, setToast, TOAST_TYPE } from "@plane/propel/toast";
import { Tooltip } from "@plane/propel/tooltip";
import type { IProject } from "@plane/types";
import type { TContextMenuItem } from "@plane/ui";
import { Avatar, AvatarGroup, FavoriteStar } from "@plane/ui";
import { copyUrlToClipboard, cn, getFileURL } from "@plane/utils";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import { usePlatformOS } from "@/hooks/use-platform-os";

const stopLinkNavigation = (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

const useProjectFavoriteToggle = (project: IProject) => {
  const { workspaceSlug } = useParams();
  const { addProjectToFavorites, removeProjectFromFavorites } = useProject();
  // local storage
  const { setValue: toggleFavoriteMenu, storedValue: isFavoriteMenuOpen } = useLocalStorage<boolean>(
    IS_FAVORITE_MENU_OPEN,
    false
  );

  const handleAddToFavorites = () => {
    if (!workspaceSlug) return;

    const addToFavoritePromise = addProjectToFavorites(workspaceSlug.toString(), project.id);
    setPromiseToast(addToFavoritePromise, {
      loading: "Adding project to favorites…",
      success: {
        title: "Success!",
        message: () => "Project added to favorites.",
        actionItems: () => {
          if (!isFavoriteMenuOpen) toggleFavoriteMenu(true);
          return <></>;
        },
      },
      error: {
        title: "Error!",
        message: () => "Couldn't add the project to favorites. Please try again.",
      },
    });
  };

  const handleRemoveFromFavorites = () => {
    if (!workspaceSlug) return;

    const removeFromFavoritePromise = removeProjectFromFavorites(workspaceSlug.toString(), project.id);
    setPromiseToast(removeFromFavoritePromise, {
      loading: "Removing project from favorites…",
      success: {
        title: "Success!",
        message: () => "Project removed from favorites.",
      },
      error: {
        title: "Error!",
        message: () => "Couldn't remove the project from favorites. Please try again.",
      },
    });
  };

  return () => {
    if (project.is_favorite) handleRemoveFromFavorites();
    else handleAddToFavorites();
  };
};

type TProjectCardMenuHandlers = {
  onJoin: () => void;
  onRestore: () => void;
  onDelete: () => void;
};

export const useProjectCardMenu = (project: IProject, handlers: TProjectCardMenuHandlers) => {
  const { onJoin, onRestore, onDelete } = handlers;
  // router
  const router = useAppRouter();
  const { workspaceSlug } = useParams();
  // auth
  const isMemberOfProject = !!project.member_role;
  const hasAdminRole = project.member_role === EUserPermissions.ADMIN;
  const hasMemberRole = project.member_role === EUserPermissions.MEMBER;
  // archive
  const isArchived = !!project.archived_at;

  const projectLink = `${workspaceSlug}/projects/${project.id}/issues`;
  const handleCopyText = () =>
    copyUrlToClipboard(projectLink).then(() =>
      setToast({
        type: TOAST_TYPE.INFO,
        title: "Link Copied!",
        message: "Project link copied to clipboard.",
      })
    );
  const handleOpenInNewTab = () => window.open(`/${projectLink}`, "_blank", "noopener,noreferrer");

  const menuItems: TContextMenuItem[] = [
    {
      key: "settings",
      action: () => router.push(`/${workspaceSlug}/settings/projects/${project.id}`),
      title: "Settings",
      icon: Settings,
      shouldRender: !isArchived && (hasAdminRole || hasMemberRole),
    },
    {
      key: "join",
      action: onJoin,
      title: "Join",
      icon: UserPlus,
      shouldRender: !isMemberOfProject && !isArchived,
    },
    {
      key: "open-new-tab",
      action: handleOpenInNewTab,
      title: "Open in new tab",
      icon: NewTabIcon,
      shouldRender: !isMemberOfProject && !isArchived,
    },
    {
      key: "copy-link",
      action: handleCopyText,
      title: "Copy link",
      icon: LinkIcon,
      shouldRender: !isArchived,
    },
    {
      key: "restore",
      action: onRestore,
      title: "Restore",
      icon: ArchiveRestoreIcon,
      shouldRender: isArchived && hasAdminRole,
    },
    {
      key: "delete",
      action: onDelete,
      title: "Delete",
      icon: TrashIcon,
      shouldRender: isArchived && hasAdminRole,
    },
  ];

  return { menuItems, handleCopyText };
};

type TProjectCardQuickActionsProps = {
  project: IProject;
  onCopyLink: () => void;
};

export const ProjectCardQuickActions = observer(function ProjectCardQuickActions(props: TProjectCardQuickActionsProps) {
  const { project, onCopyLink } = props;
  const { allowPermissions } = useUserPermissions();
  const toggleFavorite = useProjectFavoriteToggle(project);
  const shouldRenderFavorite = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );

  return (
    <div data-prevent-progress className="flex h-full flex-shrink-0 items-center gap-2">
      <button
        type="button"
        aria-label="Copy project link"
        className="flex h-6 w-6 items-center justify-center rounded-sm bg-white/10"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onCopyLink();
        }}
      >
        <LinkIcon className="h-3 w-3 text-on-color" />
      </button>
      {shouldRenderFavorite && (
        <FavoriteStar
          buttonClassName="h-6 w-6 bg-white/10 rounded-sm"
          iconClassName={cn("h-3 w-3", {
            "text-on-color": !project.is_favorite,
          })}
          onClick={(e) => {
            stopLinkNavigation(e);
            toggleFavorite();
          }}
          selected={!!project.is_favorite}
        />
      )}
    </div>
  );
});

export const ProjectCardMembers = observer(function ProjectCardMembers({ project }: { project: IProject }) {
  const { getUserDetails } = useMember();
  const { isMobile } = usePlatformOS();
  const projectMembersIds = project.members;

  return (
    <Tooltip
      isMobile={isMobile}
      tooltipHeading="Members"
      tooltipContent={project.members && project.members.length > 0 ? `${project.members.length} Members` : "No Member"}
      position="top"
    >
      {projectMembersIds && projectMembersIds.length > 0 ? (
        <div className="flex cursor-pointer items-center gap-2 text-secondary">
          <AvatarGroup showTooltip={false}>
            {projectMembersIds.map((memberId) => {
              const member = getUserDetails(memberId);
              if (!member) return null;
              return <Avatar key={member.id} name={member.display_name} src={getFileURL(member.avatar_url)} />;
            })}
          </AvatarGroup>
        </div>
      ) : (
        <span className="text-13 text-placeholder italic">No Member Yet</span>
      )}
    </Tooltip>
  );
});

type TArchivedProjectActionsProps = {
  onRestore: () => void;
  onDelete: () => void;
};

export function ArchivedProjectActions({ onRestore, onDelete }: TArchivedProjectActionsProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        className="flex items-center justify-center text-11 font-medium text-placeholder hover:text-secondary"
        onClick={(e) => {
          stopLinkNavigation(e);
          onRestore();
        }}
      >
        <div className="flex items-center gap-1.5">
          <ArchiveRestoreIcon className="h-3.5 w-3.5" />
          Restore
        </div>
      </button>
      <button
        type="button"
        aria-label="Delete project"
        className="flex items-center justify-center text-11 font-medium text-placeholder hover:text-secondary"
        onClick={(e) => {
          stopLinkNavigation(e);
          onDelete();
        }}
      >
        <TrashIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

type TProjectMembershipActionProps = {
  project: IProject;
  onJoin: () => void;
};

export function ProjectMembershipAction({ project, onJoin }: TProjectMembershipActionProps) {
  const { workspaceSlug } = useParams();

  if (!project.member_role)
    return (
      <div className="flex items-center">
        <Button
          variant="link"
          className="!p-0 font-semibold"
          onClick={(e) => {
            stopLinkNavigation(e);
            onJoin();
          }}
        >
          Join
        </Button>
      </div>
    );

  if (project.member_role === EUserPermissions.ADMIN || project.member_role === EUserPermissions.MEMBER)
    return (
      <Link
        className="flex items-center justify-center rounded-sm p-1 text-placeholder hover:bg-layer-1 hover:text-secondary"
        onClick={(e) => {
          e.stopPropagation();
        }}
        href={`/${workspaceSlug}/settings/projects/${project.id}`}
      >
        <Settings className="h-3.5 w-3.5" />
      </Link>
    );

  return (
    <span className="flex items-center gap-1 text-13 text-placeholder">
      <CheckIcon className="h-3.5 w-3.5" />
      Joined
    </span>
  );
}
