/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useRef, useState } from "react";
import type { ComponentProps } from "react";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { differenceInCalendarDays } from "date-fns/differenceInCalendarDays";
import { Button } from "@plane/propel/button";
import { ChevronLeftIcon, ChevronRightIcon, GripVertical } from "lucide-react";
import { cn, addDaysToDate, getDate, renderFormattedPayloadDate } from "@plane/utils";
import type { TGanttViews } from "@plane/types";
import { DateDropdownView } from "@/components/dropdowns/date";
import { useTaskRowNavigation } from "@/components/convex-core/tasks/lifecycle";
import { getWeeksBetweenTwoDates } from "@/components/gantt-chart/views/week-view";
import { getMonthsBetweenTwoDates } from "@/components/gantt-chart/views/month-view";
import type { NativeCalendar } from "../calendar/roots/project-view-root";
import { useParams } from "next/navigation";
// plane imports
import { Popover } from "@plane/propel/popover";
import { Tooltip } from "@plane/propel/tooltip";
import { ControlLink } from "@plane/ui";
import { generateWorkItemLink } from "@plane/utils";
// components
import { SIDEBAR_WIDTH } from "@/components/gantt-chart/constants";
import { IssueIdentifier } from "@/components/issues/issue-detail/issue-identifier";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssues } from "@/hooks/store/use-issues";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import useIssuePeekOverviewRedirection from "@/hooks/use-issue-peek-overview-redirection";
import { usePlatformOS } from "@/hooks/use-platform-os";
// local imports
import { WorkItemPreviewCard } from "../../preview-card";
import { getBlockViewDetails } from "../utils";
import type { GanttStoreType } from "./base-gantt-root";

type Props = {
  issueId: string;
  isEpic?: boolean;
};

export const IssueGanttBlock = observer(function IssueGanttBlock(props: Props) {
  const { issueId, isEpic } = props;
  // router
  const { workspaceSlug: routerWorkspaceSlug } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  // store hooks
  const { getProjectStates } = useProjectState();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  // hooks
  const { isMobile } = usePlatformOS();
  const { handleRedirection } = useIssuePeekOverviewRedirection(isEpic);

  // derived values
  const issueDetails = getIssueById(issueId);
  const stateDetails =
    issueDetails && getProjectStates(issueDetails?.project_id)?.find((state) => state?.id == issueDetails?.state_id);

  const { blockStyle } = getBlockViewDetails(issueDetails, stateDetails?.color ?? "");

  const handleIssuePeekOverview = () => handleRedirection(workspaceSlug, issueDetails, isMobile);

  return (
    <Popover delay={100} openOnHover>
      <Popover.Button
        className="w-full"
        render={
          // oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions
          <div
            id={`issue-${issueId}`}
            className="space-between relative flex h-full w-full cursor-pointer items-center rounded-sm"
            style={blockStyle}
            onClick={handleIssuePeekOverview}
          >
            <div className="absolute top-0 left-0 h-full w-full bg-surface-1/50" />
            <div
              className="sticky w-auto flex-1 truncate overflow-hidden px-2.5 py-1 text-13 text-primary"
              style={{ left: `${SIDEBAR_WIDTH}px` }}
            >
              {issueDetails?.name}
            </div>
          </div>
        }
      />
      <Popover.Panel side="bottom" align="start">
        <>
          {issueDetails && issueDetails?.project_id && (
            <WorkItemPreviewCard
              projectId={issueDetails.project_id}
              stateDetails={{
                id: issueDetails.state_id ?? undefined,
              }}
              workItem={issueDetails}
            />
          )}
        </>
      </Popover.Panel>
    </Popover>
  );
});

// rendering issues on gantt sidebar
export const IssueGanttSidebarBlock = observer(function IssueGanttSidebarBlock(props: Props) {
  const { issueId, isEpic = false } = props;
  // router
  const { workspaceSlug: routerWorkspaceSlug } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  // store hooks
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { isMobile } = usePlatformOS();
  const storeType = useIssueStoreType() as GanttStoreType;
  const { issuesFilter } = useIssues(storeType);
  const { getProjectIdentifierById } = useProject();

  // handlers
  const { handleRedirection } = useIssuePeekOverviewRedirection(isEpic);

  // derived values
  const issueDetails = getIssueById(issueId);
  const projectIdentifier = getProjectIdentifierById(issueDetails?.project_id);

  const handleIssuePeekOverview = (e: any) => {
    e.stopPropagation(true);
    e.preventDefault();
    handleRedirection(workspaceSlug, issueDetails, isMobile);
  };

  const workItemLink = generateWorkItemLink({
    workspaceSlug,
    projectId: issueDetails?.project_id,
    issueId,
    projectIdentifier,
    sequenceId: issueDetails?.sequence_id,
    isEpic,
  });

  return (
    <ControlLink
      id={`issue-${issueId}`}
      href={workItemLink}
      onClick={handleIssuePeekOverview}
      className="line-clamp-1 w-full cursor-pointer text-13 text-primary"
      disabled={!!issueDetails?.tempId}
    >
      <div className="relative flex h-full w-full cursor-pointer items-center gap-2">
        {issueDetails?.project_id && (
          <IssueIdentifier
            issueId={issueDetails.id}
            projectId={issueDetails.project_id}
            size="xs"
            variant="tertiary"
            displayProperties={issuesFilter?.issueFilters?.displayProperties}
          />
        )}
        <Tooltip tooltipContent={issueDetails?.name} isMobile={isMobile}>
          <span className="flex-grow truncate text-13 font-medium">{issueDetails?.name}</span>
        </Tooltip>
      </div>
    </ControlLink>
  );
});

const nativeTimelineSidebarWidth = `min(${SIDEBAR_WIDTH}px, 45vw)`;

type TimelineProps = ComponentProps<typeof NativeCalendar> & {
  address: FunctionReturnType<typeof api.navigation.address.resolveProjectId>;
};

function NativeTimelineTask({
  task,
  address,
  renderTask,
  cohortComplete,
  days,
  dayWidth,
  weekStartsOn,
}: {
  task: TimelineProps["tasks"][number];
  address: TimelineProps["address"];
  renderTask: TimelineProps["renderTask"];
  cohortComplete: boolean;
  days: NonNullable<ReturnType<typeof getWeeksBetweenTwoDates>[number]["children"]>;
  dayWidth: number;
  weekStartsOn: ComponentProps<typeof DateDropdownView>["weekStartsOn"];
}) {
  const [dragCommand, setDragCommand] = useState<((date: Date) => void) | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const startDate = getDate(task.startDate);
  const targetDate = getDate(task.targetDate);
  const firstDate = startDate ?? targetDate;
  const lastDate = targetDate ?? startDate;
  const start = firstDate ? differenceInCalendarDays(firstDate, days[0].date) : 0;
  const end = lastDate ? differenceInCalendarDays(lastDate, days[0].date) : 0;
  const visible = firstDate && lastDate && end >= 0 && start < days.length;
  const identifier = `${address.project.identifier}-${task.sequence}`;
  const { open } = useTaskRowNavigation(identifier, `/${address.workspace.slug}/browse/${identifier}/`);
  return renderTask(task, false, (row, writer) => {
    const beginDrag = (mode: "move" | "start" | "end", clientX: number) => {
      const grid = gridRef.current;
      if (!grid) return;
      const sourceDay = days[Math.floor((clientX - grid.getBoundingClientRect().left) / dayWidth)];
      if (!sourceDay) return;
      setDragCommand(() => (date: Date) => {
        if (mode === "start") void writer.save({ startDate: renderFormattedPayloadDate(date) });
        else if (mode === "end") void writer.save({ targetDate: renderFormattedPayloadDate(date) });
        else if (firstDate) {
          const offset = differenceInCalendarDays(date, sourceDay.date);
          void writer.save({
            startDate: task.startDate ? renderFormattedPayloadDate(addDaysToDate(task.startDate, offset)) : null,
            targetDate: task.targetDate ? renderFormattedPayloadDate(addDaysToDate(task.targetDate, offset)) : null,
          });
        }
      });
    };
    const sidebar = (
      <div
        className={cn(
          "border-subtle bg-surface-1",
          firstDate ? "sticky left-0 z-[2] shrink-0 border-r" : "min-w-0 rounded-sm border"
        )}
        style={firstDate ? { width: nativeTimelineSidebarWidth } : undefined}
      >
        {row}
        <div className="flex flex-wrap items-center gap-2 px-3 pb-2">
          <DateDropdownView
            value={task.startDate}
            onChange={(value) => void writer.save({ startDate: value ? renderFormattedPayloadDate(value) : null })}
            maxDate={targetDate}
            weekStartsOn={weekStartsOn}
            disabled={writer.disabled}
            placeholder="Start date"
            buttonVariant="border-with-text"
          />
          <DateDropdownView
            value={task.targetDate}
            onChange={(value) => void writer.save({ targetDate: value ? renderFormattedPayloadDate(value) : null })}
            minDate={startDate}
            weekStartsOn={weekStartsOn}
            disabled={writer.disabled}
            placeholder="Due date"
            buttonVariant="border-with-text"
          />
        </div>
      </div>
    );
    if (!firstDate) return sidebar;
    return (
      <div className="flex border-b border-subtle" aria-busy={writer.pending}>
        {sidebar}
        <div
          className="relative flex min-h-28 shrink-0"
          ref={gridRef}
          style={{ width: days.length * dayWidth }}
          onDragOver={(event) => {
            if (dragCommand && cohortComplete && !writer.disabled) event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            const day = days[Math.floor((event.clientX - event.currentTarget.getBoundingClientRect().left) / dayWidth)];
            if (dragCommand && cohortComplete && !writer.disabled && day) dragCommand(day.date);
            setDragCommand(null);
          }}
        >
          {days.map((day) => (
            <div
              key={day.date.toISOString()}
              className={cn("h-full shrink-0 border-r border-subtle", day.today && "bg-accent-primary/10")}
              style={{ width: dayWidth }}
            />
          ))}
          {visible ? (
            <div
              className="absolute top-8 flex h-9 overflow-hidden rounded-sm border border-accent-strong bg-accent-primary/10"
              style={{
                left: Math.max(0, start) * dayWidth,
                width: (Math.min(days.length - 1, end) - Math.max(0, start) + 1) * dayWidth,
              }}
            >
              <Button
                variant="ghost"
                size="sm"
                className="w-3 shrink-0 px-0"
                aria-label={`Resize start date of ${task.title}`}
                disabled={writer.disabled || !cohortComplete}
                draggable={!writer.disabled && cohortComplete}
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", task._id);
                  beginDrag("start", event.clientX);
                }}
                onDragEnd={() => setDragCommand(null)}
              >
                <GripVertical className="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="min-w-0 flex-1 truncate px-1 text-left"
                aria-label={`Open ${identifier}: ${task.title}`}
                disabled={writer.pending}
                draggable={!writer.disabled && cohortComplete}
                onClick={open}
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", task._id);
                  beginDrag("move", event.clientX);
                }}
                onDragEnd={() => setDragCommand(null)}
              >
                {task.title}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-3 shrink-0 px-0"
                aria-label={`Resize due date of ${task.title}`}
                disabled={writer.disabled || !cohortComplete}
                draggable={!writer.disabled && cohortComplete}
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", task._id);
                  beginDrag("end", event.clientX);
                }}
                onDragEnd={() => setDragCommand(null)}
              >
                <GripVertical className="size-3" />
              </Button>
            </div>
          ) : (
            <p className="sticky p-3 text-13 text-secondary" style={{ left: nativeTimelineSidebarWidth }}>
              Outside current dates
            </p>
          )}
        </div>
      </div>
    );
  });
}

export function NativeTimeline({ tasks, address, renderTask, cohortComplete }: TimelineProps) {
  const profile = useQuery(api.identity.profile.get, {});
  const [activeDate, setActiveDate] = useState(() => new Date());
  const [scale, setScale] = useState<TGanttViews>("month");
  if (!profile)
    return (
      <p role="status" className="p-4 text-13 text-secondary">
        Loading timeline…
      </p>
    );
  const { startOfWeek } = profile.preferences;
  const windowStart = scale === "week" ? activeDate : new Date(activeDate.getFullYear(), activeDate.getMonth(), 1);
  const windowEnd =
    scale === "week"
      ? activeDate
      : new Date(activeDate.getFullYear(), activeDate.getMonth() + (scale === "quarter" ? 3 : 1), 0);
  const weeks = getWeeksBetweenTwoDates(windowStart, windowEnd, true, startOfWeek);
  const days = weeks.flatMap((week) => week.children ?? []);
  const dayWidth = scale === "week" ? 64 : scale === "month" ? 36 : 20;
  const moveWindow = (direction: number) =>
    setActiveDate((current) =>
      scale === "week"
        ? new Date(current.getFullYear(), current.getMonth(), current.getDate() + direction * 7)
        : new Date(current.getFullYear(), current.getMonth() + direction * (scale === "quarter" ? 3 : 1), 1)
    );
  const scheduled = tasks.filter((task) => task.startDate !== null || task.targetDate !== null);
  return (
    <section className="flex min-h-0 flex-col" aria-label="Timeline work items">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-subtle px-3 py-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" aria-label="Previous timeline dates" onClick={() => moveWindow(-1)}>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" aria-label="Next timeline dates" onClick={() => moveWindow(1)}>
            <ChevronRightIcon className="size-4" />
          </Button>
          <DateDropdownView
            value={activeDate}
            onChange={(date) => {
              if (date) setActiveDate(date);
            }}
            isClearable={false}
            weekStartsOn={startOfWeek}
            formatToken="MMMM yyyy"
            buttonVariant="border-with-text"
            placeholder="Timeline date"
          />
          <Button variant="secondary" size="sm" onClick={() => setActiveDate(new Date())}>
            Today
          </Button>
        </div>
        <div className="flex gap-1" role="group" aria-label="Timeline scale">
          <Button variant="ghost" size="sm" aria-pressed={scale === "week"} onClick={() => setScale("week")}>
            Week
          </Button>
          <Button variant="ghost" size="sm" aria-pressed={scale === "month"} onClick={() => setScale("month")}>
            Month
          </Button>
          <Button variant="ghost" size="sm" aria-pressed={scale === "quarter"} onClick={() => setScale("quarter")}>
            Quarter
          </Button>
        </div>
      </div>
      <div className="overflow-auto">
        <div className="min-w-max">
          <div className="sticky top-0 z-[3] flex border-b border-subtle bg-surface-1">
            <div
              className="sticky left-0 z-[4] shrink-0 border-r border-subtle bg-surface-1 px-3 py-2 text-13 font-medium"
              style={{ width: nativeTimelineSidebarWidth }}
            >
              Work items
            </div>
            <div style={{ width: days.length * dayWidth }}>
              <div className="flex">
                <span className="px-2 py-1 text-13 font-medium">
                  {getMonthsBetweenTwoDates(days[0].date, days[days.length - 1].date)
                    .map((month) => month.title)
                    .join(" · ")}
                </span>
              </div>
              <div className="flex">
                {days.map((day) => (
                  <div
                    key={day.date.toISOString()}
                    style={{ width: dayWidth }}
                    className={cn(
                      "shrink-0 border-r border-subtle py-1 text-center text-11",
                      day.today && "bg-accent-primary/10"
                    )}
                  >
                    {day.dayData.shortTitle}
                    <br />
                    {day.date.getDate()}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {scheduled.map((task) => (
            <NativeTimelineTask
              key={task._id}
              task={task}
              address={address}
              renderTask={renderTask}
              cohortComplete={cohortComplete}
              days={days}
              dayWidth={dayWidth}
              weekStartsOn={startOfWeek}
            />
          ))}
        </div>
      </div>
      {tasks.some((task) => task.startDate === null && task.targetDate === null) && (
        <div className="border-t border-subtle p-3">
          <h3 className="mb-2 text-13 font-medium">No dates</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {tasks
              .filter((task) => task.startDate === null && task.targetDate === null)
              .map((task) => (
                <NativeTimelineTask
                  key={task._id}
                  task={task}
                  address={address}
                  renderTask={renderTask}
                  cohortComplete={cohortComplete}
                  days={days}
                  dayWidth={dayWidth}
                  weekStartsOn={startOfWeek}
                />
              ))}
          </div>
        </div>
      )}
    </section>
  );
}
