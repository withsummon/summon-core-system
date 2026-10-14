/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Paperclip } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { LinkIcon, ViewsIcon } from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";
import type { IIssueDisplayProperties, TIssue } from "@plane/types";
import { cn, generateWorkItemLink } from "@plane/utils";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useAppRouter } from "@/hooks/use-app-router";
// local imports
import { PropertySlot } from "./property-slot";
import { WithDisplayPropertiesHOC } from "./with-display-properties-HOC";

const COUNT_TILE_CLASSNAME =
  "flex h-5 flex-shrink-0 items-center justify-center gap-2 overflow-hidden rounded-sm border-[0.5px] border-strong px-2.5 py-1";

type Props = {
  issue: TIssue;
  displayProperties: IIssueDisplayProperties;
  isMobile: boolean;
  isEpic: boolean;
};

/** Read-only counters for sub-work items, attachments and links. */
export const IssueCountProperties = observer(function IssueCountProperties(props: Props) {
  const { issue, displayProperties, isMobile, isEpic } = props;
  const { t } = useTranslation();
  const router = useAppRouter();
  const { workspaceSlug } = useParams();
  const { getProjectById } = useProject();

  const subIssueCount = issue?.sub_issues_count ?? 0;

  const redirectToIssueDetail = () => {
    const workItemLink = generateWorkItemLink({
      workspaceSlug: workspaceSlug?.toString(),
      projectId: issue?.project_id,
      issueId: issue?.id,
      projectIdentifier: getProjectById(issue.project_id)?.identifier,
      sequenceId: issue?.sequence_id,
      isArchived: !!issue?.archived_at,
      isEpic,
    });
    router.push(`${workItemLink}#sub-issues`);
  };

  return (
    <>
      {/* sub-issues */}
      {!isEpic && (
        <WithDisplayPropertiesHOC
          displayProperties={displayProperties}
          displayPropertyKey="sub_issue_count"
          shouldRenderProperty={(properties) => !!properties.sub_issue_count && !!subIssueCount}
        >
          <Tooltip
            tooltipHeading={t("common.sub_work_items")}
            tooltipContent={`${subIssueCount}`}
            isMobile={isMobile}
            renderByDefault={false}
          >
            <button
              type="button"
              aria-label={`${subIssueCount} ${t("common.sub_work_items")}`}
              onFocus={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (subIssueCount) redirectToIssueDetail();
              }}
              className={cn(COUNT_TILE_CLASSNAME, {
                "cursor-pointer hover:bg-layer-1": subIssueCount,
              })}
            >
              <ViewsIcon className="h-3 w-3 flex-shrink-0" strokeWidth={2} />
              <div className="text-caption-sm-regular">{subIssueCount}</div>
            </button>
          </Tooltip>
        </WithDisplayPropertiesHOC>
      )}

      {/* attachments */}
      <WithDisplayPropertiesHOC
        displayProperties={displayProperties}
        displayPropertyKey="attachment_count"
        shouldRenderProperty={(properties) => !!properties.attachment_count && !!issue.attachment_count}
      >
        <Tooltip
          tooltipHeading={t("common.attachments")}
          tooltipContent={`${issue.attachment_count}`}
          isMobile={isMobile}
          renderByDefault={false}
        >
          <PropertySlot className={COUNT_TILE_CLASSNAME}>
            <Paperclip className="h-3 w-3 flex-shrink-0" strokeWidth={2} />
            <div className="text-caption-sm-regular">{issue.attachment_count}</div>
          </PropertySlot>
        </Tooltip>
      </WithDisplayPropertiesHOC>

      {/* link */}
      <WithDisplayPropertiesHOC
        displayProperties={displayProperties}
        displayPropertyKey="link"
        shouldRenderProperty={(properties) => !!properties.link && !!issue.link_count}
      >
        <Tooltip
          tooltipHeading={t("common.links")}
          tooltipContent={`${issue.link_count}`}
          isMobile={isMobile}
          renderByDefault={false}
        >
          <PropertySlot className={COUNT_TILE_CLASSNAME}>
            <LinkIcon className="h-3 w-3 flex-shrink-0" strokeWidth={2} />
            <div className="text-caption-sm-regular">{issue.link_count}</div>
          </PropertySlot>
        </Tooltip>
      </WithDisplayPropertiesHOC>
    </>
  );
});
