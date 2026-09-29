/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { ArchiveRestoreIcon, Settings, UserPlus, Star } from "lucide-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel, IS_FAVORITE_MENU_OPEN } from "@plane/constants";
import { useLocalStorage } from "@plane/hooks";
import { LinkIcon, NewTabIcon, TrashIcon } from "@plane/propel/icons";
import { setPromiseToast, setToast, TOAST_TYPE } from "@plane/propel/toast";
import { Tooltip } from "@plane/propel/tooltip";
import type { IProject } from "@plane/types";
import type { TContextMenuItem } from "@plane/ui";
import { Avatar, AvatarGroup, FavoriteStar } from "@plane/ui";
import { cn, copyUrlToClipboard, getFileURL } from "@plane/utils";
// components
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import { usePlatformOS } from "@/hooks/use-platform-os";
// local imports
import { CoverImage } from "@/components/common/cover-image";
import { AuthenticatedAssetImage } from "@/components/convex-core/assets/image";
import { FavoriteToggle } from "@/components/convex-core/favorites/toggle";
import { ProjectCardView } from "./card-view";
import { DeleteProjectModal } from "./delete-project-modal";
import { JoinProjectModal } from "./join-project-modal";
import { ArchiveRestoreProjectModal } from "./archive-restore-modal";

type Props = {
  project: IProject;
};

export const ProjectCard = observer(function ProjectCard(props: Props) {
  const { project } = props;
  // states
  const [deleteProjectModalOpen, setDeleteProjectModal] = useState(false);
  const [joinProjectModalOpen, setJoinProjectModal] = useState(false);
  const [restoreProject, setRestoreProject] = useState(false);
  // refs
  // router
  const router = useAppRouter();
  const { workspaceSlug } = useParams();
  // store hooks
  const { getUserDetails } = useMember();
  const { addProjectToFavorites, removeProjectFromFavorites } = useProject();
  const { allowPermissions } = useUserPermissions();
  // hooks
  const { isMobile } = usePlatformOS();
  // derived values
  const projectMembersIds = project.members;
  const shouldRenderFavorite = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );
  // auth
  const isMemberOfProject = !!project.member_role;
  const hasAdminRole = project.member_role === EUserPermissions.ADMIN;
  const hasMemberRole = project.member_role === EUserPermissions.MEMBER;
  // archive
  const isArchived = !!project.archived_at;
  // local storage
  const { setValue: toggleFavoriteMenu, storedValue: isFavoriteMenuOpen } = useLocalStorage<boolean>(
    IS_FAVORITE_MENU_OPEN,
    false
  );

  const handleAddToFavorites = () => {
    if (!workspaceSlug) return;

    const addToFavoritePromise = addProjectToFavorites(workspaceSlug.toString(), project.id);
    setPromiseToast(addToFavoritePromise, {
      loading: "Adding project to favorites...",
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
      loading: "Removing project from favorites...",
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

  const projectLink = `${workspaceSlug}/projects/${project.id}/issues`;
  const handleCopyText = () =>
    copyUrlToClipboard(projectLink).then(() =>
      setToast({
        type: TOAST_TYPE.INFO,
        title: "Link Copied!",
        message: "Project link copied to clipboard.",
      })
    );
  const handleOpenInNewTab = () => window.open(`/${projectLink}`, "_blank");

  const MENU_ITEMS: TContextMenuItem[] = [
    {
      key: "settings",
      action: () => router.push(`/${workspaceSlug}/settings/projects/${project.id}`),
      title: "Settings",
      icon: Settings,
      shouldRender: !isArchived && (hasAdminRole || hasMemberRole),
    },
    {
      key: "join",
      action: () => setJoinProjectModal(true),
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
      action: () => setRestoreProject(true),
      title: "Restore",
      icon: ArchiveRestoreIcon,
      shouldRender: isArchived && hasAdminRole,
    },
    {
      key: "delete",
      action: () => setDeleteProjectModal(true),
      title: "Delete",
      icon: TrashIcon,
      shouldRender: isArchived && hasAdminRole,
    },
  ];

  return (
    <>
      {/* Delete Project Modal */}
      <DeleteProjectModal
        project={project}
        isOpen={deleteProjectModalOpen}
        onClose={() => setDeleteProjectModal(false)}
      />
      {/* Join Project Modal */}
      {workspaceSlug && (
        <JoinProjectModal
          workspaceSlug={workspaceSlug.toString()}
          project={project}
          isOpen={joinProjectModalOpen}
          handleClose={() => setJoinProjectModal(false)}
        />
      )}
      {/* Restore project modal */}
      {workspaceSlug && project && (
        <ArchiveRestoreProjectModal
          workspaceSlug={workspaceSlug.toString()}
          projectId={project.id}
          isOpen={restoreProject}
          onClose={() => setRestoreProject(false)}
          archive={false}
        />
      )}
      <ProjectCardView
        href={`/${workspaceSlug}/projects/${project.id}/issues`}
        settingsHref={`/${workspaceSlug}/settings/projects/${project.id}`}
        name={project.name}
        identifier={project.identifier}
        network={project.network}
        logo={project.logo_props}
        description={project.description}
        createdAt={project.created_at}
        isMemberOfProject={isMemberOfProject}
        isArchived={isArchived}
        canJoin={!isMemberOfProject && !isArchived}
        canRestore={hasAdminRole}
        canDelete={hasAdminRole}
        canOpenSettings={hasAdminRole || hasMemberRole}
        favoriteControl={
          shouldRenderFavorite ? (
            <FavoriteStar
              buttonClassName="h-6 w-6 bg-white/10 rounded-sm"
              iconClassName={cn("h-3 w-3", { "text-on-color": !project.is_favorite })}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (project.is_favorite) handleRemoveFromFavorites();
                else handleAddToFavorites();
              }}
              selected={!!project.is_favorite}
            />
          ) : null
        }
        menuItems={MENU_ITEMS}
        onJoin={() => setJoinProjectModal(true)}
        onRestore={() => setRestoreProject(true)}
        onDelete={() => setDeleteProjectModal(true)}
        onCopyLink={handleCopyText}
        cover={
          <CoverImage
            src={project.cover_image_url}
            alt={project.name}
            className="absolute top-0 left-0 h-full w-full rounded-t"
          />
        }
        members={
          <Tooltip
            isMobile={isMobile}
            tooltipHeading="Members"
            tooltipContent={
              project.members && project.members.length > 0 ? `${project.members.length} Members` : "No Member"
            }
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
        }
      />
    </>
  );
});

type NativeProject = FunctionReturnType<typeof api.projects.network.get>;
type ProjectMembership = FunctionReturnType<typeof api.projects.directory.memberships>["page"][number];
type NativeProjectCardProps = {
  workspaceId: Id<"workspaces">;
  workspaceSlug: string;
  project: NativeProject;
  members: readonly ProjectMembership[] | undefined;
  ready: boolean;
  onJoin: (project: NativeProject) => void;
  onRestore: (project: NativeProject) => void;
  onDelete: (project: NativeProject) => void;
};
export function NativeProjectCard({
  workspaceId,
  workspaceSlug,
  project,
  members,
  ready,
  onJoin,
  onRestore,
  onDelete,
}: NativeProjectCardProps) {
  const router = useAppRouter();
  const href = `/${workspaceSlug}/projects/${project.projectId}/issues`;
  const settingsHref = `/${workspaceSlug}/settings/projects/${project.projectId}`;
  const copyLink = () =>
    copyUrlToClipboard(href).then(
      () => setToast({ type: TOAST_TYPE.INFO, title: "Link Copied!", message: "Project link copied to clipboard." }),
      () =>
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "Couldn't copy link",
          message: "Check clipboard permissions and try again.",
        })
    );
  return (
    <ProjectCardView
      href={href}
      settingsHref={settingsHref}
      name={project.name}
      identifier={project.identifier}
      description={project.description}
      createdAt={new Date(project.createdAt)}
      network={project.network}
      logo={project.logo ?? undefined}
      isMemberOfProject={project.joined}
      isArchived={project.archived}
      canJoin={project.canJoin}
      canRestore={project.canRestore}
      canDelete={project.canDelete}
      canOpenSettings={project.canOpenSettings}
      favoriteControl={
        ready && project.canFavorite ? (
          <FavoriteToggle
            workspaceId={workspaceId}
            target={{ type: "project", id: project.projectId }}
            render={(state, toggle, pending) => (
              <button
                type="button"
                className="grid h-6 w-6 place-items-center rounded-sm bg-white/10 disabled:opacity-50"
                aria-label={
                  state.blockedByFolder
                    ? "Restore its removed favorite folder first"
                    : state.isFavorite
                      ? "Remove favorite"
                      : "Add favorite"
                }
                aria-pressed={state.isFavorite}
                title={state.blockedByFolder ? "Restore its removed favorite folder first" : undefined}
                disabled={pending || state.blockedByFolder}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void toggle();
                }}
              >
                <Star
                  aria-hidden
                  className={cn("h-3 w-3 text-on-color", {
                    "fill-(--color-label-yellow-icon) stroke-(--color-label-yellow-icon)": state.isFavorite,
                  })}
                />
              </button>
            )}
          />
        ) : null
      }
      menuItems={[
        {
          key: "settings",
          title: "Settings",
          icon: Settings,
          shouldRender: project.canOpenSettings,
          action: () => router.push(settingsHref),
        },
        { key: "join", title: "Join", icon: UserPlus, shouldRender: project.canJoin, action: () => onJoin(project) },
        {
          key: "open-new-tab",
          title: "Open in new tab",
          icon: NewTabIcon,
          shouldRender: !project.joined && !project.archived,
          action: () => {
            window.open(href, "_blank", "noopener,noreferrer");
          },
        },
        {
          key: "copy-link",
          title: "Copy link",
          icon: LinkIcon,
          shouldRender: !project.archived,
          action: () => void copyLink(),
        },
        {
          key: "restore",
          title: "Restore",
          icon: ArchiveRestoreIcon,
          shouldRender: project.canRestore,
          action: () => onRestore(project),
        },
        {
          key: "delete",
          title: "Delete",
          icon: TrashIcon,
          shouldRender: project.archived && project.canDelete,
          action: () => onDelete(project),
        },
      ]}
      onJoin={() => onJoin(project)}
      onRestore={() => onRestore(project)}
      onDelete={() => onDelete(project)}
      onCopyLink={() => void copyLink()}
      cover={
        project.cover ? (
          <AuthenticatedAssetImage
            asset={project.cover}
            alt={project.name}
            className="absolute top-0 left-0 h-full w-full rounded-t object-cover"
          />
        ) : (
          <CoverImage
            src={project.externalCoverUrl ?? undefined}
            alt={project.name}
            className="absolute top-0 left-0 h-full w-full rounded-t"
          />
        )
      }
      members={<NativeProjectMembers members={members} />}
    />
  );
}

function NativeProjectMembers({ members }: { members: readonly ProjectMembership[] | undefined }) {
  if (members === undefined)
    return (
      <span className="text-13 text-placeholder" role="status">
        Loading members…
      </span>
    );
  return (
    <Tooltip
      tooltipHeading="Members"
      tooltipContent={members.length ? `${members.length} Members` : "No Member"}
      position="top"
    >
      {members.length ? (
        <div className="flex cursor-pointer items-center gap-2 text-secondary" aria-label={`${members.length} Members`}>
          <AvatarGroup showTooltip={false}>
            {members.map((member) =>
              member.avatar ? (
                <AuthenticatedAssetImage
                  key={member.userId}
                  asset={member.avatar}
                  compactName={member.name}
                  alt={member.name}
                  className="size-6 rounded-full object-cover"
                />
              ) : (
                <Avatar key={member.userId} name={member.name} />
              )
            )}
          </AvatarGroup>
        </div>
      ) : (
        <span className="text-13 text-placeholder italic">No Member Yet</span>
      )}
    </Tooltip>
  );
}
