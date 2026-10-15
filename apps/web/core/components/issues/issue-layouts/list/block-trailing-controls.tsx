/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { MutableRefObject } from "react";
import type { IIssueDisplayProperties, TIssue } from "@plane/types";
import { Spinner } from "@plane/ui";
import { cn } from "@plane/utils";
// components
import { IssueProperties } from "@/components/issues/issue-layouts/properties";
// local imports
import type { TRenderQuickActions } from "./list-view-types";

type Props = {
  issue: TIssue;
  issueRef: MutableRefObject<HTMLDivElement | null>;
  isTemporary: boolean;
  isSidebarCollapsed: boolean | undefined;
  canEditIssueProperties: boolean;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  quickActions: TRenderQuickActions;
  displayProperties: IIssueDisplayProperties | undefined;
  isEpic: boolean;
};

/** Properties and desktop quick actions on the right of a list block; a spinner while the item is still being created. */
export function ListBlockTrailingControls(props: Props) {
  const {
    issue,
    issueRef,
    isTemporary,
    isSidebarCollapsed,
    canEditIssueProperties,
    updateIssue,
    quickActions,
    displayProperties,
    isEpic,
  } = props;

  if (isTemporary)
    return (
      <div className="h-4 w-4">
        <Spinner className="h-4 w-4" />
      </div>
    );

  return (
    <>
      <IssueProperties
        className={cn("relative flex flex-wrap items-center gap-2 whitespace-nowrap", {
          "md:flex-shrink-0 md:flex-grow": isSidebarCollapsed,
          "lg:flex-shrink-0 lg:flex-grow": !isSidebarCollapsed,
        })}
        issue={issue}
        isReadOnly={!canEditIssueProperties}
        updateIssue={updateIssue}
        // Priority and state lead the row, before the identifier and title.
        displayProperties={displayProperties && { ...displayProperties, priority: false, state: false }}
        activeLayout="List"
        isEpic={isEpic}
      />
      {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
      <div
        className={cn("hidden", {
          "md:flex": isSidebarCollapsed,
          "lg:flex": !isSidebarCollapsed,
        })}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {quickActions({
          issue,
          parentRef: issueRef,
        })}
      </div>
    </>
  );
}
