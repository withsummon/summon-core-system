/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { DAYS_LIST } from "@plane/constants";
import { Button } from "@plane/propel/button";
import { ChevronLeftIcon, ChevronRightIcon, GripVertical } from "lucide-react";
import { cn, generateCalendarData, getDate, getOrderedDays, renderFormattedPayloadDate } from "@plane/utils";
import { DateDropdownView } from "@/components/dropdowns/date";
import type { useTaskPropertyWriter } from "@/components/convex-core/tasks/task-properties";
import { getWeeksBetweenTwoDates } from "@/components/gantt-chart/views/week-view";

type CalendarProps = {
  tasks: FunctionReturnType<typeof api.savedViews.results.list>["page"];
  displayFilters: NonNullable<FunctionArgs<typeof api.savedViews.index.create>["displayFilters"]>;
  cohortComplete: boolean;
  renderTask: (
    task: FunctionReturnType<typeof api.savedViews.results.list>["page"][number],
    kanban?: boolean,
    renderContent?: (row: ReactNode, writer: ReturnType<typeof useTaskPropertyWriter>) => ReactNode
  ) => ReactNode;
};

function CalendarTask({
  task,
  renderTask,
  cohortComplete,
  onDrag,
  weekStartsOn,
}: {
  task: CalendarProps["tasks"][number];
  renderTask: CalendarProps["renderTask"];
  cohortComplete: boolean;
  onDrag: (command: ((date: string) => void) | null) => void;
  weekStartsOn: FunctionReturnType<typeof api.identity.profile.get>["preferences"]["startOfWeek"];
}) {
  return (
    <div className="rounded-sm border border-subtle bg-surface-1">
      {renderTask(task, true, (row, writer) => (
        <>
          {row}
          <div
            className="flex items-center justify-between gap-1 border-t border-subtle px-2 py-1"
            aria-busy={writer.pending}
          >
            <span
              aria-hidden="true"
              className="p-1 text-tertiary"
              draggable={!writer.disabled && cohortComplete}
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", task._id);
                event.dataTransfer.effectAllowed = "move";
                onDrag((targetDate) => void writer.save({ targetDate }));
              }}
              onDragEnd={() => onDrag(null)}
            >
              <GripVertical className="size-3.5" />
            </span>
            <DateDropdownView
              value={task.targetDate}
              onChange={(value) => void writer.save({ targetDate: value ? renderFormattedPayloadDate(value) : null })}
              minDate={getDate(task.startDate)}
              weekStartsOn={weekStartsOn}
              disabled={writer.disabled}
              placeholder="Due date"
              buttonVariant="border-with-text"
              className="max-w-full min-w-0"
            />
          </div>
        </>
      ))}
    </div>
  );
}

export function NativeCalendar({ tasks, displayFilters, cohortComplete, renderTask }: CalendarProps) {
  const profile = useQuery(api.identity.profile.get, {});
  const [activeDate, setActiveDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => renderFormattedPayloadDate(new Date()));
  const [dragCommand, setDragCommand] = useState<((date: string) => void) | null>(null);
  if (!profile)
    return (
      <p role="status" className="p-4 text-13 text-secondary">
        Loading calendar…
      </p>
    );
  const { startOfWeek } = profile.preferences;
  const { layout, showWeekends } = displayFilters.calendar;
  const calendar = generateCalendarData(null, activeDate, startOfWeek);
  const days =
    layout === "week"
      ? (getWeeksBetweenTwoDates(activeDate, activeDate, true, startOfWeek)[0].children ?? [])
      : Object.values(calendar[`y-${activeDate.getFullYear()}`][`m-${activeDate.getMonth()}`]).flatMap((week) =>
          Object.values(week).map((day) => ({ date: day.date, today: day.is_today }))
        );
  const visibleDays = days.filter((day) => showWeekends || (day.date.getDay() !== 0 && day.date.getDay() !== 6));
  const weekdays = getOrderedDays(Object.values(DAYS_LIST), (day) => day.value, startOfWeek).filter(
    (day) => showWeekends || (day.value !== 0 && day.value !== 6)
  );
  const moveWindow = (direction: number) => {
    const next =
      layout === "month"
        ? new Date(activeDate.getFullYear(), activeDate.getMonth() + direction, 1)
        : new Date(activeDate.getFullYear(), activeDate.getMonth(), activeDate.getDate() + direction * 7);
    setActiveDate(next);
    setSelectedDate(renderFormattedPayloadDate(next));
  };
  const taskCard = (task: CalendarProps["tasks"][number]) => (
    <CalendarTask
      key={task._id}
      task={task}
      renderTask={renderTask}
      cohortComplete={cohortComplete}
      onDrag={(command) => setDragCommand(() => command)}
      weekStartsOn={startOfWeek}
    />
  );
  return (
    <section className="flex min-h-0 flex-col" aria-label="Calendar work items">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-subtle px-3 py-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" aria-label={`Previous ${layout}`} onClick={() => moveWindow(-1)}>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" aria-label={`Next ${layout}`} onClick={() => moveWindow(1)}>
            <ChevronRightIcon className="size-4" />
          </Button>
          <DateDropdownView
            value={activeDate}
            onChange={(date) => {
              if (date) {
                setActiveDate(date);
                setSelectedDate(renderFormattedPayloadDate(date));
              }
            }}
            isClearable={false}
            weekStartsOn={startOfWeek}
            formatToken="MMMM yyyy"
            buttonVariant="border-with-text"
            placeholder="Calendar date"
          />
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            const today = new Date();
            setActiveDate(today);
            setSelectedDate(renderFormattedPayloadDate(today));
          }}
        >
          Today
        </Button>
      </div>
      <div className={cn("grid border-b border-subtle", showWeekends ? "grid-cols-7" : "grid-cols-5")}>
        {weekdays.map((day) => (
          <div key={day.value} className="bg-layer-1 p-2 text-center text-13 font-medium">
            {day.shortTitle}
          </div>
        ))}
      </div>
      <div className={cn("grid", showWeekends ? "grid-cols-7" : "grid-cols-5")}>
        {visibleDays.map((day) => {
          const value = renderFormattedPayloadDate(day.date);
          const dayTasks = tasks.filter((task) => task.targetDate === value);
          return (
            <div
              key={value}
              className="min-w-0 border-r border-b border-subtle md:min-h-36"
              onDragOver={(event) => {
                if (dragCommand && cohortComplete) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragCommand && cohortComplete && value) dragCommand(value);
                setDragCommand(null);
              }}
            >
              <Button
                variant="ghost"
                size="sm"
                aria-label={day.date.toDateString()}
                aria-pressed={selectedDate === value}
                onClick={() => setSelectedDate(value)}
                className={cn(
                  "m-1",
                  day.today && "bg-accent-primary text-on-color",
                  selectedDate === value && "ring-1 ring-accent-strong"
                )}
              >
                {day.date.getDate()}
                {cohortComplete && dayTasks.length > 0 && <span className="ml-1 text-11">({dayTasks.length})</span>}
              </Button>
              <div className="hidden space-y-1 p-1 md:block">{dayTasks.map(taskCard)}</div>
            </div>
          );
        })}
      </div>
      <div className="space-y-2 p-3 md:hidden">
        <h3 className="text-13 font-medium">{selectedDate}</h3>
        {tasks.filter((task) => task.targetDate === selectedDate).map(taskCard)}
      </div>
      {tasks.some((task) => task.targetDate === null) && (
        <div className="space-y-2 border-t border-subtle p-3">
          <h3 className="text-13 font-medium">No due date</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {tasks.filter((task) => task.targetDate === null).map(taskCard)}
          </div>
        </div>
      )}
    </section>
  );
}
