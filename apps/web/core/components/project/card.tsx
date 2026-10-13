/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useRef, useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { useParams } from "next/navigation";
// plane imports
import { EUserPermissions } from "@plane/constants";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { LockIcon } from "@plane/propel/icons";
import type { IProject } from "@plane/types";
import { ContextMenu } from "@plane/ui";
import { cn, renderFormattedDate } from "@plane/utils";
// local imports
import { CoverImage } from "@/components/common/cover-image";
import { DeleteProjectModal } from "./delete-project-modal";
import { JoinProjectModal } from "./join-project-modal";
import { ArchiveRestoreProjectModal } from "./archive-restore-modal";
import {
  ArchivedProjectActions,
  ProjectCardMembers,
  ProjectCardQuickActions,
  ProjectMembershipAction,
  useProjectCardMenu,
} from "./card-sections";

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
  const projectCardRef = useRef(null);
  // router
  const { workspaceSlug } = useParams();
  // auth
  const isMemberOfProject = !!project.member_role;
  const hasAdminRole = project.member_role === EUserPermissions.ADMIN;
  // archive
  const isArchived = !!project.archived_at;
  const { menuItems, handleCopyText } = useProjectCardMenu(project, {
    onJoin: () => setJoinProjectModal(true),
    onRestore: () => setRestoreProject(true),
    onDelete: () => setDeleteProjectModal(true),
  });

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
      <Link
        ref={projectCardRef}
        href={`/${workspaceSlug}/projects/${project.id}/issues`}
        onClick={(e) => {
          if (!isMemberOfProject || isArchived) {
            e.preventDefault();
            e.stopPropagation();
            if (!isArchived) setJoinProjectModal(true);
          }
        }}
        data-prevent-progress={!isMemberOfProject || isArchived}
        className={cn(
          "group/project-card flex w-full flex-col justify-between overflow-hidden rounded-lg border border-subtle bg-layer-2 transition-[border-color,box-shadow] duration-300 hover:border-strong hover:shadow-raised-200"
        )}
      >
        <ContextMenu parentRef={projectCardRef} items={menuItems} />
        <div className="relative h-[118px] w-full rounded-t">
          <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/60 to-transparent" />

          <CoverImage
            src={project.cover_image_url}
            alt={project.name}
            className="absolute top-0 left-0 h-full w-full rounded-t"
          />

          <div className="absolute bottom-4 z-[1] flex h-10 w-full items-center justify-between gap-3 px-4">
            <div className="flex flex-grow items-center gap-2.5 truncate">
              <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-sm bg-white/10">
                <Logo logo={project.logo_props} size={18} />
              </div>

              <div className="flex w-full flex-col justify-between gap-0.5 truncate">
                <h3 className="truncate font-semibold text-on-color" title={project.name}>
                  {project.name}
                </h3>
                <span className="flex items-center gap-1.5">
                  <p className="text-11 font-medium text-on-color">{project.identifier} </p>
                  {project.network === 0 && <LockIcon className="h-2.5 w-2.5 text-on-color" />}
                </span>
              </div>
            </div>

            {!isArchived && <ProjectCardQuickActions project={project} onCopyLink={handleCopyText} />}
          </div>
        </div>

        <div
          className={cn("flex h-[104px] w-full flex-col justify-between rounded-b-sm p-4", {
            "opacity-90": isArchived,
          })}
        >
          <p className="line-clamp-2 text-13 break-words text-tertiary">
            {project.description && project.description.trim() !== ""
              ? project.description
              : `Created on ${renderFormattedDate(project.created_at)}`}
          </p>
          <div className="item-center flex justify-between">
            <div className="flex items-center justify-center gap-2">
              <ProjectCardMembers project={project} />
              {isArchived && <div className="text-11 font-medium text-placeholder">Archived</div>}
            </div>
            {isArchived ? (
              hasAdminRole && (
                <ArchivedProjectActions
                  onRestore={() => setRestoreProject(true)}
                  onDelete={() => setDeleteProjectModal(true)}
                />
              )
            ) : (
              <ProjectMembershipAction project={project} onJoin={() => setJoinProjectModal(true)} />
            )}
          </div>
        </div>
      </Link>
    </>
  );
});
