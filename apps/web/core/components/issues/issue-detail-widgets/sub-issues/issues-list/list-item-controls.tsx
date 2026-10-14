/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Link as Loader } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { LinkIcon, EditIcon, TrashIcon, CloseIcon, ChevronRightIcon } from "@plane/propel/icons";
import type { TIssue, TIssueServiceType, TSubIssueOperations } from "@plane/types";
import { EIssueServiceType } from "@plane/types";
import { CustomMenu } from "@plane/ui";
import { cn } from "@plane/utils";
// helpers
import { useSubIssueOperations } from "@/components/issues/issue-detail-widgets/sub-issues/helper";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";

type TExpandToggleProps = {
  workspaceSlug: string;
  projectId: string;
  parentIssueId: string;
  issueId: string;
};

/** Chevron that loads and reveals a sub-work item's own children, or a spinner while they load. */
export const SubIssueExpandToggle = observer(function SubIssueExpandToggle(props: TExpandToggleProps) {
  const { workspaceSlug, projectId, parentIssueId, issueId } = props;
  const {
    subIssues: { subIssueHelpersByIssueId, setSubIssueHelpers },
  } = useIssueDetail();
  const { fetchSubIssues } = useSubIssueOperations(EIssueServiceType.ISSUES);

  const subIssueHelpers = subIssueHelpersByIssueId(parentIssueId);
  const isExpanded = subIssueHelpers.issue_visibility.includes(issueId);

  if (subIssueHelpers.preview_loader.includes(issueId))
    return (
      <div className="flex h-full w-full cursor-not-allowed items-center justify-center rounded-xs bg-layer-1">
        <Loader width={14} strokeWidth={2} className="animate-spin" />
      </div>
    );

  return (
    <button
      type="button"
      aria-label={isExpanded ? "Hide sub-work items" : "Show sub-work items"}
      aria-expanded={isExpanded}
      className="flex h-full w-full cursor-pointer items-center justify-center text-placeholder hover:text-tertiary"
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!subIssueHelpers.issue_visibility.includes(issueId)) {
          setSubIssueHelpers(parentIssueId, "preview_loader", issueId);
          await fetchSubIssues(workspaceSlug, projectId, issueId);
          setSubIssueHelpers(parentIssueId, "preview_loader", issueId);
        }
        setSubIssueHelpers(parentIssueId, "issue_visibility", issueId);
      }}
    >
      <ChevronRightIcon
        className={cn("size-3.5 transition-[rotate]", {
          "rotate-90": isExpanded,
        })}
        strokeWidth={2.5}
      />
    </button>
  );
});

type TItemMenuProps = {
  workspaceSlug: string;
  parentIssueId: string;
  issue: TIssue;
  workItemLink: string;
  canEdit: boolean;
  handleIssueCrudState: (
    key: "create" | "existing" | "update" | "delete",
    issueId: string,
    issue?: TIssue | null
  ) => void;
  subIssueOperations: TSubIssueOperations;
  issueServiceType: TIssueServiceType;
};

/** Edit, copy link, remove from parent and delete actions for one sub-work item. */
export const SubIssueItemMenu = observer(function SubIssueItemMenu(props: TItemMenuProps) {
  const {
    workspaceSlug,
    parentIssueId,
    issue,
    workItemLink,
    canEdit,
    handleIssueCrudState,
    subIssueOperations,
    issueServiceType,
  } = props;
  const { t } = useTranslation();
  const { toggleCreateIssueModal, toggleDeleteIssueModal } = useIssueDetail(issueServiceType);

  return (
    <CustomMenu placement="bottom-end" ellipsis>
      {canEdit && (
        <CustomMenu.MenuItem
          onClick={() => {
            handleIssueCrudState("update", parentIssueId, { ...issue });
            toggleCreateIssueModal(true);
          }}
        >
          <div className="flex items-center gap-2">
            <EditIcon className="h-3.5 w-3.5" strokeWidth={2} />
            <span>{t("issue.edit")}</span>
          </div>
        </CustomMenu.MenuItem>
      )}

      <CustomMenu.MenuItem
        onClick={() => {
          subIssueOperations.copyLink(workItemLink);
        }}
      >
        <div className="flex items-center gap-2">
          <LinkIcon className="h-3.5 w-3.5" strokeWidth={2} />
          <span>{t("issue.copy_link")}</span>
        </div>
      </CustomMenu.MenuItem>

      {canEdit && (
        <CustomMenu.MenuItem
          onClick={() => {
            if (issue.project_id)
              subIssueOperations.removeSubIssue(workspaceSlug, issue.project_id, parentIssueId, issue.id);
          }}
        >
          <div className="flex items-center gap-2">
            <CloseIcon className="h-3.5 w-3.5" strokeWidth={2} />
            {issueServiceType === EIssueServiceType.ISSUES ? t("issue.remove.parent.label") : t("issue.remove.label")}
          </div>
        </CustomMenu.MenuItem>
      )}

      {canEdit && (
        <CustomMenu.MenuItem
          onClick={() => {
            handleIssueCrudState("delete", parentIssueId, issue);
            toggleDeleteIssueModal(issue.id);
          }}
        >
          <div className="flex items-center gap-2">
            <TrashIcon className="h-3.5 w-3.5" strokeWidth={2} />
            <span>{t("issue.delete.label")}</span>
          </div>
        </CustomMenu.MenuItem>
      )}
    </CustomMenu>
  );
});
