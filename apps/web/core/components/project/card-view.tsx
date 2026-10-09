/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, type ReactNode } from "react";
import Link from "next/link";
import { ArchiveRestoreIcon, Settings } from "lucide-react";
import { Button } from "@plane/propel/button";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { LinkIcon, LockIcon, TrashIcon, CheckIcon } from "@plane/propel/icons";
import type { TLogoProps } from "@plane/types";
import type { TContextMenuItem } from "@plane/ui";
import { ContextMenu } from "@plane/ui";
import { cn, renderFormattedDate } from "@plane/utils";

type Props = {
  href: string;
  settingsHref: string;
  name: string;
  identifier: string;
  network?: number;
  logo?: TLogoProps;
  description?: string;
  createdAt?: string | Date;
  isMemberOfProject: boolean;
  isArchived: boolean;
  canRestore: boolean;
  canDelete: boolean;
  canOpenSettings: boolean;
  favoriteControl: ReactNode;
  canJoin: boolean;
  menuItems: TContextMenuItem[];
  cover: ReactNode;
  members: ReactNode;
  onJoin: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
};
export function ProjectCardView({
  href,
  settingsHref,
  name,
  identifier,
  network,
  logo,
  description,
  createdAt,
  isMemberOfProject,
  isArchived,
  canRestore,
  canDelete,
  canOpenSettings,
  favoriteControl,
  canJoin,
  menuItems,
  cover,
  members,
  onJoin,
  onRestore,
  onDelete,
  onCopyLink,
}: Props) {
  const projectCardRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={projectCardRef}
      className={cn(
        "group/project-card relative flex w-full flex-col justify-between overflow-hidden rounded-lg border border-subtle bg-layer-2 transition-all duration-300 hover:border-strong hover:shadow-raised-200"
      )}
    >
      {!isArchived &&
        (isMemberOfProject ? (
          <Link
            href={href}
            aria-label={`Open ${name}`}
            className="absolute inset-0 z-[1] rounded-lg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-strong"
          />
        ) : canJoin ? (
          <button
            type="button"
            aria-label={`Join ${name}`}
            onClick={onJoin}
            className="absolute inset-0 z-[1] cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-strong"
          />
        ) : null)}
      <ContextMenu parentRef={projectCardRef} items={menuItems} />
      <div className="pointer-events-none relative h-[118px] w-full rounded-t">
        <div className="absolute inset-0 z-[1] bg-gradient-to-t from-black/60 to-transparent" />

        {cover}

        <div className="absolute bottom-4 z-[1] flex h-10 w-full items-center justify-between gap-3 px-4">
          <div className="flex flex-grow items-center gap-2.5 truncate">
            <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-sm bg-white/10">
              <Logo logo={logo} size={18} />
            </div>

            <div className="flex w-full flex-col justify-between gap-0.5 truncate">
              <h3 className="truncate font-semibold text-on-color">{name}</h3>
              <span className="flex items-center gap-1.5">
                <p className="text-11 font-medium text-on-color">{identifier} </p>
                {network === 0 && <LockIcon className="h-2.5 w-2.5 text-on-color" />}
              </span>
            </div>
          </div>

          {!isArchived && (
            <div data-prevent-progress className="pointer-events-auto flex h-full flex-shrink-0 items-center gap-2">
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
              {favoriteControl}
            </div>
          )}
        </div>
      </div>

      <div
        className={cn("pointer-events-none relative flex h-[104px] w-full flex-col justify-between rounded-b-sm p-4", {
          "opacity-90": isArchived,
        })}
      >
        <p className="line-clamp-2 text-13 break-words text-tertiary">
          {description && description.trim() !== "" ? description : `Created on ${renderFormattedDate(createdAt)}`}
        </p>
        <div className="item-center flex justify-between">
          <div className="pointer-events-auto relative z-[2] flex items-center justify-center gap-2">
            {members}

            {isArchived && <div className="text-11 font-medium text-placeholder">Archived</div>}
          </div>
          {isArchived ? (
            (canRestore || canDelete) && (
              <div className="pointer-events-auto relative z-[2] flex items-center justify-center gap-2">
                {canRestore && (
                  <button
                    type="button"
                    className="flex items-center justify-center text-11 font-medium text-placeholder hover:text-secondary"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRestore();
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <ArchiveRestoreIcon className="h-3.5 w-3.5" />
                      Restore
                    </div>
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    aria-label="Delete project"
                    className="flex items-center justify-center text-11 font-medium text-placeholder hover:text-secondary"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDelete();
                    }}
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )
          ) : (
            <>
              {isMemberOfProject &&
                (canOpenSettings ? (
                  <Link
                    aria-label="Project settings"
                    className="pointer-events-auto relative z-[2] flex items-center justify-center rounded-sm p-1 text-placeholder hover:bg-layer-1 hover:text-secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    href={settingsHref}
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <span className="flex items-center gap-1 text-13 text-placeholder">
                    <CheckIcon className="h-3.5 w-3.5" />
                    Joined
                  </span>
                ))}
              {!isMemberOfProject && canJoin && (
                <div className="pointer-events-auto relative z-[2] flex items-center">
                  <Button
                    variant="link"
                    className="!p-0 font-semibold"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onJoin();
                    }}
                  >
                    Join
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
