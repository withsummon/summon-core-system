/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { useContext } from "react";
import type { ComponentProps } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { NativeTaskCreateContext } from "@/components/workspace/native-shell/session";
import { SquareStackIcon } from "lucide-react";
import { CopyIcon, EditIcon, TrashIcon } from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";
import { Row } from "@plane/ui";
import { IdentifierText } from "../issue-detail/identifier-text";
import { DraftIssueProperties } from "./draft-issue-properties";
import { WorkspaceDraftIssueQuickActions } from "./quick-action";
type Draft = FunctionReturnType<typeof api.tasks.drafts.index.list>["page"][number];

export function DraftIssueBlock({
  issue,
  onEdit,
  onCopy,
  onMove,
  onDelete,
  onRestore,
}: {
  issue: Draft;
  onEdit: () => void;
  onCopy: () => void;
  onMove: () => void;
  onDelete: () => void;
  onRestore: () => void;
}) {
  const createTask = useContext(NativeTaskCreateContext);
  const MENU_ITEMS: ComponentProps<typeof WorkspaceDraftIssueQuickActions>["MENU_ITEMS"] =
    issue.deletedAt !== null
      ? [{ key: "restore", title: "restore", icon: EditIcon, action: onRestore }]
      : [
          { key: "edit", title: "edit", icon: EditIcon, action: onEdit },
          { key: "make-a-copy", title: "make_a_copy", icon: CopyIcon, action: onCopy },
          {
            key: "move-to-issues",
            title: "move_to_project",
            icon: SquareStackIcon,
            action: onMove,
            disabled: issue.copySource ? !issue.canPublish : !createTask,
          },
          { key: "delete", title: "delete", icon: TrashIcon, action: onDelete },
        ];
  return (
    <WorkspaceDraftIssueQuickActions
      MENU_ITEMS={MENU_ITEMS}
      renderRow={(actions) => (
        <div
          id={`draft-${issue._id}`}
          className="relative w-full border-b border-subtle-1"
          onDoubleClick={issue.deletedAt === null ? onEdit : undefined}
        >
          <Row className="group/list-block relative flex min-h-11 flex-col gap-3 bg-layer-transparent py-3 text-13 transition-colors hover:bg-layer-transparent-hover lg:flex-row lg:items-center">
            <div className="flex min-w-0 grow items-center gap-1">
              {issue.project ? (
                <IdentifierText
                  identifier={issue.project.identifier}
                  enableClickToCopyIdentifier
                  size="xs"
                  variant="tertiary"
                />
              ) : (
                <span className="text-11 text-secondary">No project</span>
              )}
              <div className="size-4 shrink-0" />
              <Tooltip tooltipContent={issue.title || "Untitled draft"} position="top-start" renderByDefault={false}>
                <button
                  type="button"
                  onClick={(event) => {
                    if (issue.deletedAt !== null) onRestore();
                    else if (event.detail === 0) onEdit();
                  }}
                  className="w-full min-w-0 truncate text-left text-13 text-primary"
                >
                  {issue.title || "Untitled draft"}
                </button>
              </Tooltip>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <DraftIssueProperties
                className="relative flex flex-wrap items-center gap-2 whitespace-nowrap"
                issue={issue}
              />
              {actions}
            </div>
          </Row>
        </div>
      )}
    />
  );
}
