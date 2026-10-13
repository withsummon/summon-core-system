/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// i18n
import { useTranslation } from "@plane/i18n";
// ui icons
import {
  CycleIcon,
  StatePropertyIcon,
  ModuleIcon,
  MembersPropertyIcon,
  PriorityPropertyIcon,
  StartDatePropertyIcon,
  DueDatePropertyIcon,
  LabelPropertyIcon,
  UserCirclePropertyIcon,
  EstimatePropertyIcon,
  ParentPropertyIcon,
} from "@plane/propel/icons";
import type { IUserLite, TIssue, TStateGroups } from "@plane/types";
import { cn, getDate, renderFormattedPayloadDate, shouldHighlightIssueDueDate } from "@plane/utils";
// components
import { DateDropdown } from "@/components/dropdowns/date";
import { EstimateDropdown } from "@/components/dropdowns/estimate";
import { ButtonAvatars } from "@/components/dropdowns/member/avatar";
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
import { PriorityDropdown } from "@/components/dropdowns/priority";
import { StateDropdown } from "@/components/dropdowns/state/dropdown";
import { SidebarPropertyListItem } from "@/components/common/layout/sidebar/property-list-item";
// helpers
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
// plane web components
import { IssueParentSelectRoot } from "@/components/issues/parent-select-root";
import type { TIssueOperations } from "../issue-detail";
import { IssueCycleSelect } from "../issue-detail/cycle-select";
import { IssueLabel } from "../issue-detail/label";
import { IssueModuleSelect } from "../issue-detail/module-select";

interface IPeekOverviewProperties {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
  issueOperations: TIssueOperations;
}

type TPeekOverviewCreatedByProps = {
  createdBy: IUserLite;
};

function PeekOverviewCreatedBy(props: TPeekOverviewCreatedByProps) {
  const { createdBy } = props;
  const { t } = useTranslation();
  // intake work items are created by a bot user and shown as created by Plane
  const isIntakeBot = createdBy.display_name?.includes("-intake");

  return (
    <SidebarPropertyListItem icon={UserCirclePropertyIcon} label={t("common.created_by")} childrenClassName="px-2">
      <ButtonAvatars showTooltip userIds={isIntakeBot ? null : createdBy.id} />
      <span className="grow truncate text-body-xs-medium leading-5 text-secondary">
        {isIntakeBot ? "Plane" : createdBy.display_name}
      </span>
    </SidebarPropertyListItem>
  );
}

type TPeekOverviewDatePropertiesProps = {
  issue: TIssue;
  stateGroup: TStateGroups | undefined;
  disabled: boolean;
  onUpdate: (data: Partial<TIssue>) => void;
};

function PeekOverviewDateProperties(props: TPeekOverviewDatePropertiesProps) {
  const { issue, stateGroup, disabled, onUpdate } = props;
  const { t } = useTranslation();
  const minDate = getDate(issue.start_date);
  const maxDate = getDate(issue.target_date);

  return (
    <>
      <SidebarPropertyListItem icon={StartDatePropertyIcon} label={t("common.order_by.start_date")}>
        <DateDropdown
          value={issue.start_date}
          onChange={(val) => onUpdate({ start_date: val ? renderFormattedPayloadDate(val) : null })}
          placeholder={t("issue.add.start_date")}
          buttonVariant="transparent-with-text"
          maxDate={maxDate}
          disabled={disabled}
          className="group w-full grow"
          buttonContainerClassName="w-full text-left h-7.5"
          buttonClassName={cn("text-body-xs-medium", { "text-placeholder": !issue.start_date })}
          hideIcon
          clearIconClassName="h-3 w-3 hidden group-hover:inline"
        />
      </SidebarPropertyListItem>

      <SidebarPropertyListItem icon={DueDatePropertyIcon} label={t("common.order_by.due_date")}>
        <div className="flex w-full items-center gap-2">
          <DateDropdown
            value={issue.target_date}
            onChange={(val) => onUpdate({ target_date: val ? renderFormattedPayloadDate(val) : null })}
            placeholder={t("issue.add.due_date")}
            buttonVariant="transparent-with-text"
            minDate={minDate}
            disabled={disabled}
            className="group w-full grow"
            buttonContainerClassName="w-full text-left h-7.5"
            buttonClassName={cn("text-body-xs-medium", {
              "text-placeholder": !issue.target_date,
              "text-danger-primary": shouldHighlightIssueDueDate(issue.target_date, stateGroup),
            })}
            hideIcon
            clearIconClassName="h-3 w-3 hidden group-hover:inline text-primary"
          />
        </div>
      </SidebarPropertyListItem>
    </>
  );
}

export const PeekOverviewProperties = observer(function PeekOverviewProperties(props: IPeekOverviewProperties) {
  const { workspaceSlug, projectId, issueId, issueOperations, disabled } = props;
  const { t } = useTranslation();
  // store hooks
  const { getProjectById } = useProject();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { getStateById } = useProjectState();
  const { getUserDetails } = useMember();
  // derived values
  const issue = getIssueById(issueId);
  if (!issue) return <></>;
  const createdByDetails = getUserDetails(issue.created_by);
  const projectDetails = getProjectById(issue.project_id);
  const isEstimateEnabled = projectDetails?.estimate;
  const stateDetails = getStateById(issue.state_id);

  const assigneeCount = issue.assignee_ids?.length ?? 0;
  const hasPriority = Boolean(issue.priority) && issue.priority !== "none";

  return (
    <div>
      <h6 className="text-body-xs-medium">{t("common.properties")}</h6>
      <div className={cn("mt-3 w-full space-y-3", { "opacity-60": disabled })}>
        <SidebarPropertyListItem icon={StatePropertyIcon} label={t("common.state")}>
          <StateDropdown
            value={issue.state_id}
            onChange={(val) => issueOperations.update(workspaceSlug, projectId, issueId, { state_id: val })}
            projectId={projectId}
            disabled={disabled}
            buttonVariant="transparent-with-text"
            className="group w-full grow"
            buttonContainerClassName="w-full text-left h-7.5"
            buttonClassName={cn("text-body-xs-medium", { "text-placeholder": !issue.state_id })}
            dropdownArrow
            dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
          />
        </SidebarPropertyListItem>

        <SidebarPropertyListItem icon={MembersPropertyIcon} label={t("common.assignees")}>
          <MemberDropdown
            value={issue.assignee_ids}
            onChange={(val) => issueOperations.update(workspaceSlug, projectId, issueId, { assignee_ids: val })}
            disabled={disabled}
            projectId={projectId}
            placeholder={t("issue.add.assignee")}
            multiple
            buttonVariant={assigneeCount > 1 ? "transparent-without-text" : "transparent-with-text"}
            className="group w-full grow"
            buttonContainerClassName="w-full text-left h-7.5"
            buttonClassName={cn("justify-between text-body-xs-medium", { "text-placeholder": assigneeCount === 0 })}
            hideIcon={assigneeCount === 0}
            dropdownArrow
            dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
          />
        </SidebarPropertyListItem>

        <SidebarPropertyListItem icon={PriorityPropertyIcon} label={t("common.priority")}>
          <PriorityDropdown
            value={issue.priority}
            onChange={(val) => issueOperations.update(workspaceSlug, projectId, issueId, { priority: val })}
            disabled={disabled}
            buttonVariant="transparent-with-text"
            className="h-7.5 w-full grow rounded-sm"
            buttonContainerClassName="w-full text-left h-7.5"
            buttonClassName={cn("text-body-xs-medium whitespace-nowrap [&_svg]:size-3.5", {
              "text-placeholder": !hasPriority,
            })}
          />
        </SidebarPropertyListItem>

        {createdByDetails && <PeekOverviewCreatedBy createdBy={createdByDetails} />}

        <PeekOverviewDateProperties
          issue={issue}
          stateGroup={stateDetails?.group}
          disabled={disabled}
          onUpdate={(data) => issueOperations.update(workspaceSlug, projectId, issueId, data)}
        />

        {isEstimateEnabled && (
          <SidebarPropertyListItem icon={EstimatePropertyIcon} label={t("common.estimate")}>
            <EstimateDropdown
              value={issue.estimate_point ?? undefined}
              onChange={(val) => issueOperations.update(workspaceSlug, projectId, issueId, { estimate_point: val })}
              projectId={projectId}
              disabled={disabled}
              buttonVariant="transparent-with-text"
              className="group w-full grow"
              buttonContainerClassName="w-full text-left h-7.5"
              buttonClassName={cn("text-body-xs-medium", { "text-placeholder": issue.estimate_point === undefined })}
              placeholder="None"
              hideIcon
              dropdownArrow
              dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
            />
          </SidebarPropertyListItem>
        )}

        {projectDetails?.module_view && (
          <SidebarPropertyListItem icon={ModuleIcon} label={t("common.modules")}>
            <IssueModuleSelect
              className="w-full grow"
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              issueId={issueId}
              issueOperations={issueOperations}
              disabled={disabled}
            />
          </SidebarPropertyListItem>
        )}

        {projectDetails?.cycle_view && (
          <SidebarPropertyListItem icon={CycleIcon} label={t("common.cycle")} appendElement={null}>
            <IssueCycleSelect
              className="h-7.5 w-full grow"
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              issueId={issueId}
              issueOperations={issueOperations}
              disabled={disabled}
            />
          </SidebarPropertyListItem>
        )}

        <SidebarPropertyListItem icon={ParentPropertyIcon} label={t("common.parent")}>
          <IssueParentSelectRoot
            className="h-7.5 w-full grow"
            disabled={disabled}
            issueId={issueId}
            issueOperations={issueOperations}
            projectId={projectId}
            workspaceSlug={workspaceSlug}
          />
        </SidebarPropertyListItem>

        <SidebarPropertyListItem icon={LabelPropertyIcon} label={t("common.labels")}>
          <IssueLabel workspaceSlug={workspaceSlug} projectId={projectId} issueId={issueId} disabled={disabled} />
        </SidebarPropertyListItem>
      </div>
    </div>
  );
});
