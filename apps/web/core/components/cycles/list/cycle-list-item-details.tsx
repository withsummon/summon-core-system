/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { MouseEvent } from "react";
import { useState } from "react";
import { observer } from "mobx-react";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { ArrowRight, CalendarDays, Eye } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { MembersPropertyIcon, TransferIcon } from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";
import type { ICycle } from "@plane/types";
import { Avatar, AvatarGroup } from "@plane/ui";
import { generateQueryParams, getDate, getFileURL } from "@plane/utils";
// components
import { DateRangeDropdown } from "@/components/dropdowns/date-range";
import { ButtonAvatars } from "@/components/dropdowns/member/avatar";
import { MergedDateDisplay } from "@/components/dropdowns/merged-date";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useAppRouter } from "@/hooks/use-app-router";
import { useTimeZoneConverter } from "@/hooks/use-timezone-converter";
// local imports
import { TransferIssuesModal } from "../transfer-issues-modal";

type TCycleDetailsProps = {
  projectId: string;
  cycleDetails: ICycle;
};

function CycleUserTimezoneRange({ projectId, cycleDetails }: TCycleDetailsProps) {
  const { renderFormattedDateInUserTimezone } = useTimeZoneConverter(projectId);
  return (
    <span className="flex gap-1">
      {renderFormattedDateInUserTimezone(cycleDetails.start_date ?? "")}
      <ArrowRight className="my-auto h-3 w-3 flex-shrink-0" />
      {renderFormattedDateInUserTimezone(cycleDetails.end_date ?? "")}
    </span>
  );
}

type TActiveCycleDurationProps = TCycleDetailsProps & {
  createdById: string | undefined;
};

export const ActiveCycleDuration = observer(function ActiveCycleDuration(props: TActiveCycleDurationProps) {
  const { projectId, cycleDetails, createdById } = props;
  const { t } = useTranslation();
  const { isProjectTimeZoneDifferent, getProjectUTCOffset } = useTimeZoneConverter(projectId);
  const projectUTCOffset = getProjectUTCOffset();

  return (
    <div className="flex gap-2">
      {/* Duration */}
      <Tooltip
        tooltipContent={<CycleUserTimezoneRange projectId={projectId} cycleDetails={cycleDetails} />}
        disabled={!isProjectTimeZoneDifferent()}
        tooltipHeading={t("project_cycles.in_your_timezone")}
      >
        <div className="flex items-center gap-1 text-11 font-medium text-tertiary">
          <CalendarDays className="my-auto h-3 w-3 flex-shrink-0" />
          <MergedDateDisplay startDate={cycleDetails.start_date} endDate={cycleDetails.end_date} />
        </div>
      </Tooltip>
      {projectUTCOffset && (
        <span className="cursor-default rounded-md bg-layer-1 px-2 py-1 text-11 text-tertiary">{projectUTCOffset}</span>
      )}
      {/* created by */}
      {createdById && <ButtonAvatars showTooltip={false} userIds={createdById} />}
    </div>
  );
});

export const CycleDateRange = observer(function CycleDateRange({ projectId, cycleDetails }: TCycleDetailsProps) {
  const { t } = useTranslation();
  const { isProjectTimeZoneDifferent } = useTimeZoneConverter(projectId);
  // captured once so the date picker's lower bound stays stable across renders
  const [today] = useState(() => new Date());

  return (
    <DateRangeDropdown
      buttonVariant={"transparent-with-text"}
      buttonContainerClassName={`h-6 w-full cursor-auto flex items-center gap-1.5 text-tertiary rounded-sm text-11 [&>div]:hover:bg-transparent`}
      buttonClassName="p-0"
      minDate={today}
      value={{
        from: getDate(cycleDetails.start_date),
        to: getDate(cycleDetails.end_date),
      }}
      placeholder={{
        from: t("project_cycles.start_date"),
        to: t("project_cycles.end_date"),
      }}
      showTooltip={isProjectTimeZoneDifferent()}
      customTooltipHeading={t("project_cycles.in_your_timezone")}
      customTooltipContent={<CycleUserTimezoneRange projectId={projectId} cycleDetails={cycleDetails} />}
      mergeDates
      required={cycleDetails.status !== "draft"}
      disabled
      hideIcon={{
        from: false,
        to: false,
      }}
    />
  );
});

export const CycleMembers = observer(function CycleMembers(props: { cycleDetails: ICycle; isMobile: boolean }) {
  const { cycleDetails, isMobile } = props;
  const { getUserDetails } = useMember();
  const assigneeIds = cycleDetails.assignee_ids;

  return (
    <Tooltip tooltipContent={`${assigneeIds?.length} Members`} isMobile={isMobile}>
      <div className="flex w-min cursor-default items-center justify-center">
        {assigneeIds && assigneeIds.length > 0 ? (
          <AvatarGroup showTooltip={false}>
            {assigneeIds.map((assignee_id) => {
              const member = getUserDetails(assignee_id);
              return <Avatar key={member?.id} name={member?.display_name} src={getFileURL(member?.avatar_url ?? "")} />;
            })}
          </AvatarGroup>
        ) : (
          <MembersPropertyIcon className="h-4 w-4 text-tertiary" />
        )}
      </div>
    </Tooltip>
  );
});

type TCycleOverviewButtonProps = {
  cycleId: string;
  isActive: boolean;
  isMobile: boolean;
};

export function CycleOverviewButton({ cycleId, isActive, isMobile }: TCycleOverviewButtonProps) {
  const { t } = useTranslation();
  // router
  const router = useAppRouter();
  const searchParams = useSearchParams();
  // react-doctor-disable-next-line rerender-defer-reads-hook -- useSearchParams is read during render, so location changes re-render this anyway
  const pathname = usePathname();

  const openCycleOverview = (e: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const query = generateQueryParams(searchParams, ["peekCycle"]);
    if (searchParams.has("peekCycle") && searchParams.get("peekCycle") === cycleId) {
      router.push(`${pathname}?${query}`);
    } else {
      router.push(`${pathname}?${query && `${query}&`}peekCycle=${cycleId}`);
    }
  };

  return (
    <button
      type="button"
      onClick={openCycleOverview}
      className={`z-[1] flex flex-shrink-0 gap-1 text-11 text-accent-secondary ${isMobile || (isActive && !searchParams.has("peekCycle")) ? "flex" : "hidden group-hover:flex"}`}
    >
      <Eye className="my-auto h-4 w-4 text-accent-secondary" />
      <span>{t("project_cycles.more_details")}</span>
    </button>
  );
}

type TCycleTransferIssuesButtonProps = {
  cycleId: string;
  cycleDetails: ICycle;
  isCompleted: boolean;
};

/** Owns the transfer modal so it stays mounted while closing even after the button hides. */
export function CycleTransferIssuesButton({ cycleId, cycleDetails, isCompleted }: TCycleTransferIssuesButtonProps) {
  const { t } = useTranslation();
  // router
  const { projectId: routerProjectId } = useParams();
  // states
  const [transferIssuesModal, setTransferIssuesModal] = useState(false);
  // derived values
  const transferableIssuesCount = cycleDetails
    ? cycleDetails.total_issues - (cycleDetails.cancelled_issues + cycleDetails.completed_issues)
    : 0;
  const showTransferIssues = routerProjectId && transferableIssuesCount > 0 && isCompleted;

  return (
    <>
      <TransferIssuesModal
        handleClose={() => setTransferIssuesModal(false)}
        isOpen={transferIssuesModal}
        cycleId={cycleId.toString()}
      />
      {showTransferIssues && (
        <button
          type="button"
          className="flex h-6 cursor-pointer items-center gap-1 px-2 text-accent-secondary"
          onClick={() => {
            setTransferIssuesModal(true);
          }}
        >
          <TransferIcon className="w-4 fill-accent-primary" />
          <span>{t("project_cycles.transfer_work_items", { count: transferableIssuesCount })}</span>
        </button>
      )}
    </>
  );
}
