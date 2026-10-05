/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { useParams } from "next/navigation";
import { LinkIcon } from "lucide-react";
// plane imports
import { StatePropertyIcon, StateGroupIcon, PriorityPropertyIcon, DueDatePropertyIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { cn } from "@plane/utils";
import { IssueBlockPriority } from "@/components/issues/issue-layouts/properties/priority";
// helpers
import { renderFormattedDate } from "@/helpers/date-time.helper";
import { stateGroups, shouldHighlightIssueDueDate } from "@/helpers/issue.helper";
import { copyTextToClipboard, addSpaceIfCamelCase } from "@/helpers/string.helper";
// hooks
import { usePublish } from "@/hooks/store/publish";
import { useStates } from "@/hooks/store/use-state";
// types

type Props = {
  issueDetails: FunctionReturnType<typeof api.publicSharing.index.getTask>;
  mode?: "full";
};

export function PeekOverviewIssueProperties({ issueDetails, mode }: Props) {
  // hooks
  const states = useStates();
  const state = states?.find((row) => row._id === issueDetails.stateId);

  const { anchor } = useParams();

  const publication = usePublish(anchor?.toString() ?? "");

  const handleCopyLink = async () => {
    try {
      await copyTextToClipboard(window.location.href);
      setToast({ type: TOAST_TYPE.INFO, title: "Link copied!", message: "Work item link copied to clipboard." });
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Link could not be copied",
        message: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  return (
    <div className={mode === "full" ? "divide-y divide-subtle-1" : ""}>
      {mode === "full" && (
        <div className="flex justify-between gap-2 pb-3">
          <h6 className="flex items-center gap-2 font-medium">
            {publication?.project.identifier}-{issueDetails.sequence}
          </h6>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleCopyLink} className="-rotate-45" aria-label="Copy work item link">
              <LinkIcon className="size-3.5 shrink-0" />
            </button>
          </div>
        </div>
      )}
      <div className={`space-y-2 ${mode === "full" ? "pt-3" : ""}`}>
        <div className="flex h-8 items-center gap-3">
          <div className="flex w-1/4 flex-shrink-0 items-center gap-1 text-13 text-tertiary">
            <StatePropertyIcon className="size-4 flex-shrink-0" />
            <span>State</span>
          </div>
          <div className="flex w-3/4 items-center gap-1.5 py-0.5 text-13">
            <StateGroupIcon stateGroup={state ? stateGroups[state.status] : "backlog"} color={state?.color} />
            {addSpaceIfCamelCase(state?.name ?? "Unassigned")}
          </div>
        </div>

        <div className="flex h-8 items-center gap-3">
          <div className="flex w-1/4 flex-shrink-0 items-center gap-1 text-13 text-tertiary">
            <PriorityPropertyIcon className="size-4 flex-shrink-0" />
            <span>Priority</span>
          </div>
          <div className="w-3/4">
            <IssueBlockPriority priority={issueDetails.priority} shouldShowName />
          </div>
        </div>

        <div className="flex h-8 items-center gap-3">
          <div className="flex w-1/4 flex-shrink-0 items-center gap-1 text-13 text-tertiary">
            <DueDatePropertyIcon className="size-4 flex-shrink-0" />
            <span>Due date</span>
          </div>
          <div>
            {issueDetails.targetDate ? (
              <div
                className={cn("flex items-center gap-1.5 rounded-sm py-0.5 text-11 text-primary", {
                  "text-danger-primary": shouldHighlightIssueDueDate(
                    issueDetails.targetDate,
                    stateGroups[issueDetails.status]
                  ),
                })}
              >
                <DueDatePropertyIcon className="size-3" />
                {renderFormattedDate(issueDetails.targetDate)}
              </div>
            ) : (
              <span className="text-13 text-secondary">Empty</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
