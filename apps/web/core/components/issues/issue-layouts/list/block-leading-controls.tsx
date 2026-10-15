/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { MouseEvent } from "react";
import { observer } from "mobx-react";
import { ChevronRightIcon } from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";
import type { IIssueDisplayProperties, TIssue } from "@plane/types";
import { cn } from "@plane/utils";
// components
import { MultipleSelectEntityAction } from "@/components/core/multiple-select";
import { PriorityDropdown } from "@/components/dropdowns/priority";
import { StateDropdown } from "@/components/dropdowns/state/dropdown";
import { IssueIdentifier } from "@/components/issues/issue-detail/issue-identifier";
// hooks
import type { TSelectionHelper } from "@/hooks/use-multiple-select";
import { usePlatformOS } from "@/hooks/use-platform-os";
// local imports
import { PropertySlot } from "../properties/property-slot";
import { calculateIdentifierWidth } from "../utils";

type TSelectCheckboxProps = {
  issue: TIssue;
  groupId: string;
  projectId: string;
  isSelected: boolean;
  selectionHelpers: TSelectionHelper;
};

/** Hover-revealed selection checkbox; only work items in the current project can be selected. */
const ListBlockSelectCheckbox = observer(function ListBlockSelectCheckbox(props: TSelectCheckboxProps) {
  const { issue, groupId, projectId, isSelected, selectionHelpers } = props;
  const isInCurrentProject = issue.project_id === projectId;

  return (
    <Tooltip
      tooltipContent={
        <>
          Only work items within the current
          <br />
          project can be selected.
        </>
      }
      disabled={isInCurrentProject}
    >
      <div className="absolute left-1 grid w-3.5 flex-shrink-0 place-items-center">
        <MultipleSelectEntityAction
          className={cn(
            "pointer-events-none opacity-0 transition-opacity group-focus-within/list-block:pointer-events-auto group-focus-within/list-block:opacity-100 group-hover/list-block:pointer-events-auto group-hover/list-block:opacity-100",
            {
              "pointer-events-auto opacity-100": isSelected,
            }
          )}
          groupId={groupId}
          id={issue.id}
          selectionHelpers={selectionHelpers}
          disabled={!isInCurrentProject}
        />
      </div>
    </Tooltip>
  );
});

type TIdentifierProps = {
  issueId: string;
  projectId: string | null;
  displayProperties: IIssueDisplayProperties;
  minWidth: number;
};

function ListBlockIdentifier(props: TIdentifierProps) {
  const { issueId, projectId, displayProperties, minWidth } = props;

  return (
    <div className="flex-shrink-0" style={{ minWidth: `${minWidth}px` }}>
      {projectId && (
        <IssueIdentifier
          issueId={issueId}
          projectId={projectId}
          size="xs"
          variant="tertiary"
          displayProperties={displayProperties}
        />
      )}
    </div>
  );
}

type TSubIssueToggleProps = {
  isExpanded: boolean;
  onToggle: (e: MouseEvent<HTMLButtonElement>) => void;
};

function ListBlockSubIssueToggle(props: TSubIssueToggleProps) {
  const { isExpanded, onToggle } = props;

  return (
    <button
      type="button"
      className="grid size-4 place-items-center rounded-xs text-placeholder hover:text-tertiary"
      aria-label={isExpanded ? "Collapse sub-work items" : "Expand sub-work items"}
      aria-expanded={isExpanded}
      onClick={onToggle}
    >
      <ChevronRightIcon className={cn("size-4", { "rotate-90": isExpanded })} strokeWidth={2.5} />
    </button>
  );
}

type TLeadingControlsProps = {
  issue: TIssue;
  groupId: string;
  projectId: string | undefined;
  projectIdentifier: string | undefined;
  maxSequenceId: number | undefined;
  displayProperties: IIssueDisplayProperties | undefined;
  selectionHelpers: TSelectionHelper;
  isSelected: boolean;
  canSelect: boolean;
  showSubIssueToggle: boolean;
  isExpanded: boolean;
  onToggleExpand: (e: MouseEvent<HTMLButtonElement>) => void;
  /** Indent in px for sub-work items; undefined for top-level rows. */
  marginLeft: number | undefined;
  isTemporary: boolean;
  isReadOnly: boolean;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
};

/** Selection checkbox, priority, identifier, sub-work-item toggle and state at the start of a list block. */
export const ListBlockLeadingControls = observer(function ListBlockLeadingControls(props: TLeadingControlsProps) {
  const {
    issue,
    groupId,
    projectId,
    projectIdentifier,
    maxSequenceId = 1,
    displayProperties,
    selectionHelpers,
    isSelected,
    canSelect,
    showSubIssueToggle,
    isExpanded,
    onToggleExpand,
    marginLeft,
    isTemporary,
    isReadOnly,
    updateIssue,
  } = props;
  const { isMobile } = usePlatformOS();

  // Calculate width for: projectIdentifier + "-" + dynamic sequence number digits
  // Use next_work_item_sequence from backend (static value from project endpoint)
  const keyMinWidth = displayProperties?.key
    ? calculateIdentifierWidth(projectIdentifier?.length ?? 0, maxSequenceId)
    : 0;
  const showIdentifier = displayProperties?.key || displayProperties?.issue_type;

  return (
    <div className="flex items-center gap-1" style={marginLeft === undefined ? {} : { marginLeft: `${marginLeft}px` }}>
      {/* select checkbox */}
      {canSelect && projectId && (
        <ListBlockSelectCheckbox
          issue={issue}
          groupId={groupId}
          projectId={projectId}
          isSelected={isSelected}
          selectionHelpers={selectionHelpers}
        />
      )}
      {displayProperties?.priority && (
        <PropertySlot className="flex h-5 shrink-0">
          <PriorityDropdown
            value={issue.priority}
            onChange={(priority) => void updateIssue?.(issue.project_id, issue.id, { priority })}
            disabled={isReadOnly || isTemporary}
            buttonVariant="transparent-without-text"
            buttonClassName="px-0.5"
            renderByDefault={isMobile}
            showTooltip
          />
        </PropertySlot>
      )}
      {showIdentifier && displayProperties && (
        <ListBlockIdentifier
          issueId={issue.id}
          projectId={issue.project_id}
          displayProperties={displayProperties}
          minWidth={keyMinWidth}
        />
      )}

      {/* sub-issues chevron */}
      <div className="grid size-4 flex-shrink-0 place-items-center">
        {showSubIssueToggle && <ListBlockSubIssueToggle isExpanded={isExpanded} onToggle={onToggleExpand} />}
      </div>

      {displayProperties?.state && issue.project_id && (
        <PropertySlot className="mr-1 flex h-5 shrink-0">
          <StateDropdown
            value={issue.state_id}
            onChange={(state_id) => void updateIssue?.(issue.project_id, issue.id, { state_id })}
            projectId={issue.project_id}
            disabled={isReadOnly || isTemporary}
            buttonVariant="transparent-without-text"
            buttonClassName="px-0.5"
            renderByDefault={isMobile}
            showTooltip
          />
        </PropertySlot>
      )}

      {isTemporary && <div className="absolute top-0 left-0 z-[99999] h-full w-full animate-pulse bg-surface-1/20" />}
    </div>
  );
});
