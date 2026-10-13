/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Box,
  Calendar,
  CalendarClock,
  CalendarPlus,
  Check,
  ChevronRight,
  CircleDashed,
  History,
  ListFilter,
  SignalHigh,
  SlidersHorizontal,
  Tag,
  UserPen,
  UserRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getButtonStyling } from "@plane/propel/button";
import { Chip } from "@plane/propel/chip";
import { IconButton } from "@plane/propel/icon-button";
import { MENU_ITEM_CLASSNAME, MENU_POPUP_CLASSNAME, MenuPrimitive as Menu } from "@plane/propel/menu";
import { Popover } from "@plane/propel/popover";
import { Select } from "@plane/propel/select";
import { Switch } from "@plane/propel/switch";
import { cn } from "@plane/utils";
import {
  DEFAULT_TASK_DISPLAY,
  type TTaskDisplay,
  type TTaskFilterField,
  type TTaskFilters,
  type TTaskGrouping,
  type TTaskOrdering,
  type TTaskPastWindow,
  type TTaskProperty,
} from "./task-center";

type TTaskFilterOption = { value: string; label: string; icon?: ReactNode };
export type TTaskFilterOptions = Record<TTaskFilterField, TTaskFilterOption[]>;

const FIELD_META: Record<TTaskFilterField, { label: string; Icon: LucideIcon }> = {
  status: { label: "Status", Icon: CircleDashed },
  assignee: { label: "Assignee", Icon: UserRound },
  creator: { label: "Creator", Icon: UserPen },
  priority: { label: "Priority", Icon: SignalHigh },
  label: { label: "Labels", Icon: Tag },
  project: { label: "Project", Icon: Box },
  due: { label: "Due date", Icon: CalendarClock },
  created: { label: "Created", Icon: CalendarPlus },
  updated: { label: "Updated", Icon: History },
};
const MENU_SECTIONS: TTaskFilterField[][] = [["status", "assignee", "creator", "priority", "label"], ["project"]];
const DATE_FIELDS: TTaskFilterField[] = ["due", "created", "updated"];

const GROUPING_OPTIONS: { value: TTaskGrouping; label: string }[] = [
  { value: "status", label: "Status" },
  { value: "assignee", label: "Assignee" },
  { value: "project", label: "Project" },
  { value: "priority", label: "Priority" },
  { value: "none", label: "No grouping" },
];
const ORDERING_OPTIONS: { value: TTaskOrdering; label: string }[] = [
  { value: "priority", label: "Priority" },
  { value: "due", label: "Due date" },
  { value: "created", label: "Created" },
  { value: "updated", label: "Updated" },
  { value: "title", label: "Title" },
];
const PAST_OPTIONS: { value: TTaskPastWindow; label: string }[] = [
  { value: "day", label: "Past day" },
  { value: "week", label: "Past week" },
  { value: "month", label: "Past month" },
];
export const DATE_FILTER_OPTIONS = {
  due: [
    { value: "overdue", label: "Overdue" },
    { value: "today", label: "Due today" },
    { value: "week", label: "Due this week" },
    { value: "next7", label: "Due in the next 7 days" },
    { value: "none", label: "No due date" },
  ],
  created: PAST_OPTIONS,
  updated: PAST_OPTIONS,
} satisfies Partial<TTaskFilterOptions>;
const COMPLETED_OPTIONS: { value: TTaskDisplay["completed"]; label: string }[] = [
  { value: "all", label: "All" },
  ...PAST_OPTIONS,
  { value: "none", label: "None" },
];
const PROPERTY_OPTIONS: { value: TTaskProperty; label: string }[] = [
  { value: "id", label: "ID" },
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "assignee", label: "Assignee" },
  { value: "project", label: "Project" },
  { value: "due", label: "Due date" },
  { value: "labels", label: "Labels" },
  { value: "created", label: "Created" },
  { value: "updated", label: "Updated" },
];

const POPUP_CLASSNAME = cn(MENU_POPUP_CLASSNAME, "max-h-[min(24rem,var(--available-height))] w-60");
const INPUT_CLASSNAME =
  "mb-1 w-full border-b border-subtle bg-transparent px-2 pt-1 pb-2 text-13 text-primary outline-none placeholder:text-placeholder";

/** Linear-style filter menu: searchable fields, each opening a searchable multi-select of its values. */
export function TaskFilterMenu(props: {
  filters: TTaskFilters;
  options: TTaskFilterOptions;
  onToggle: (field: TTaskFilterField, value: string) => void;
}) {
  const available = (fields: TTaskFilterField[]) => fields.filter((field) => props.options[field].length > 0);
  const fieldMenu = (field: TTaskFilterField) => (
    <FieldSubmenu
      key={field}
      field={field}
      selected={props.filters[field] ?? []}
      options={props.options[field]}
      onToggle={props.onToggle}
    />
  );

  return (
    <Menu.FilterProvider autoHighlight>
      <Menu.Root>
        <Menu.Trigger className={getButtonStyling("secondary", "base")}>
          <ListFilter aria-hidden="true" className="size-4" />
          Filter
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-[120]">
            <Menu.Popup className={POPUP_CLASSNAME}>
              <Menu.Input aria-label="Add filter" placeholder="Add filter…" className={INPUT_CLASSNAME} />
              <Menu.List>
                {available(MENU_SECTIONS[0]).map(fieldMenu)}
                <Menu.Separator className="my-1 h-px bg-(--border-color-subtle)" />
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger label="Dates" className={MENU_ITEM_CLASSNAME}>
                    <Calendar aria-hidden="true" className="size-4 text-secondary" />
                    <span className="flex-1">Dates</span>
                    <SelectedCount count={DATE_FIELDS.reduce((sum, f) => sum + (props.filters[f]?.length ?? 0), 0)} />
                    <ChevronRight aria-hidden="true" className="size-3.5 text-tertiary" />
                  </Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner side="right" align="start" sideOffset={4} className="z-[130]">
                      <Menu.Popup className={POPUP_CLASSNAME}>{DATE_FIELDS.map(fieldMenu)}</Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
                {available(MENU_SECTIONS[1]).map(fieldMenu)}
              </Menu.List>
              <Menu.Empty className="px-2 py-1.5 text-13 text-placeholder">No matching filters</Menu.Empty>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </Menu.FilterProvider>
  );
}

function FieldSubmenu(props: {
  field: TTaskFilterField;
  selected: string[];
  options: TTaskFilterOption[];
  onToggle: (field: TTaskFilterField, value: string) => void;
}) {
  const { label, Icon } = FIELD_META[props.field];
  // Short fixed lists (priority, due windows) read faster without a search field.
  const searchable = props.options.length > 6;
  const selected = new Set(props.selected);
  const items = props.options.map((option) => (
    <Menu.CheckboxItem
      key={option.value}
      label={option.label}
      checked={selected.has(option.value)}
      onCheckedChange={() => props.onToggle(props.field, option.value)}
      className={MENU_ITEM_CLASSNAME}
    >
      {option.icon}
      <span className="min-w-0 flex-1 truncate">{option.label}</span>
      <Menu.CheckboxItemIndicator className="flex-none text-accent-primary">
        <Check aria-hidden="true" className="size-4" />
      </Menu.CheckboxItemIndicator>
    </Menu.CheckboxItem>
  ));
  const submenu = (
    <Menu.SubmenuRoot>
      <Menu.SubmenuTrigger label={label} className={MENU_ITEM_CLASSNAME}>
        <Icon aria-hidden="true" className="size-4 text-secondary" />
        <span className="flex-1">{label}</span>
        <SelectedCount count={props.selected.length} />
        <ChevronRight aria-hidden="true" className="size-3.5 text-tertiary" />
      </Menu.SubmenuTrigger>
      <Menu.Portal>
        <Menu.Positioner side="right" align="start" sideOffset={4} className="z-[130]">
          <Menu.Popup className={POPUP_CLASSNAME}>
            {searchable ? (
              <>
                <Menu.Input
                  aria-label={`Filter ${label.toLowerCase()}`}
                  placeholder={`${label}…`}
                  className={INPUT_CLASSNAME}
                />
                <Menu.List>{items}</Menu.List>
                <Menu.Empty className="px-2 py-1.5 text-13 text-placeholder">No matches</Menu.Empty>
              </>
            ) : (
              items
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.SubmenuRoot>
  );
  return searchable ? (
    <Menu.FilterProvider key={props.field} autoHighlight>
      {submenu}
    </Menu.FilterProvider>
  ) : (
    submenu
  );
}

function SelectedCount({ count }: { count: number }) {
  return count ? <span className="text-12 text-tertiary tabular-nums">{count}</span> : null;
}

/** One removable pill per active field: "Status is In progress, Done". */
export function AppliedTaskFilters(props: {
  filters: TTaskFilters;
  options: TTaskFilterOptions;
  onClearField: (field: TTaskFilterField) => void;
  onClearAll: () => void;
}) {
  const active = (Object.keys(FIELD_META) as TTaskFilterField[]).filter((field) => props.filters[field]?.length);
  if (!active.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-subtle px-4 py-2 sm:px-6">
      {active.map((field) => {
        const { label, Icon } = FIELD_META[field];
        const values = props.filters[field] ?? [];
        const names = values.map(
          (value) => props.options[field].find((option) => option.value === value)?.label ?? value
        );
        return (
          <span
            key={field}
            className="inline-flex h-7 max-w-full items-center rounded-md border border-subtle text-12 text-secondary"
          >
            <span className="flex items-center gap-1.5 border-r border-subtle px-2">
              <Icon aria-hidden="true" className="size-3.5" />
              {label}
            </span>
            <span className="border-r border-subtle px-2">{values.length > 1 ? "is any of" : "is"}</span>
            <span className="min-w-0 truncate px-2 text-primary" title={names.join(", ")}>
              {names.join(", ")}
            </span>
            <button
              type="button"
              aria-label={`Remove ${label.toLowerCase()} filter`}
              onClick={() => props.onClearField(field)}
              className="flex h-full items-center rounded-r-md border-l border-subtle px-1.5 hover:bg-layer-transparent-hover hover:text-primary focus-visible:outline-2 focus-visible:outline-accent-strong focus-visible:outline-solid"
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          </span>
        );
      })}
      <button
        type="button"
        onClick={props.onClearAll}
        className="h-7 rounded-md px-2 text-12 text-secondary hover:bg-layer-transparent-hover hover:text-primary focus-visible:outline-2 focus-visible:outline-accent-strong focus-visible:outline-solid"
      >
        Clear
      </button>
    </div>
  );
}

/** Linear-style display options: how tasks are grouped, ordered, which ones show, and which properties. */
export function TaskDisplayPopover(props: { display: TTaskDisplay; onChange: (display: TTaskDisplay) => void }) {
  const { display } = props;
  const set = <K extends keyof TTaskDisplay>(key: K, value: TTaskDisplay[K]) =>
    props.onChange({ ...display, [key]: value });
  const isDefault = JSON.stringify(display) === JSON.stringify(DEFAULT_TASK_DISPLAY);

  return (
    <Popover>
      <Popover.Button className={getButtonStyling("secondary", "base")}>
        <SlidersHorizontal aria-hidden="true" className="size-4" />
        Display
      </Popover.Button>
      <Popover.Panel
        placement="bottom-end"
        sideOffset={4}
        positionerClassName="z-[110]"
        className="w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-subtle bg-surface-1 text-13 text-primary shadow-overlay-100"
      >
        <div className="space-y-2 p-4">
          <Row label="Grouping">
            <Select
              aria-label="Grouping"
              value={display.grouping}
              onValueChange={(value) => set("grouping", value as TTaskGrouping)}
              options={GROUPING_OPTIONS}
              className="h-8 w-40"
            />
          </Row>
          <Row label="Ordering">
            <IconButton
              variant="ghost"
              size="sm"
              icon={display.descending ? ArrowDownWideNarrow : ArrowUpNarrowWide}
              aria-label={display.descending ? "Descending; switch to ascending" : "Ascending; switch to descending"}
              onClick={() => set("descending", !display.descending)}
            />
            <Select
              aria-label="Ordering"
              value={display.ordering}
              onValueChange={(value) => set("ordering", value as TTaskOrdering)}
              options={ORDERING_OPTIONS}
              className="h-8 w-40"
            />
          </Row>
          <Row label="Order completed by recency">
            <Switch
              label="Order completed by recency"
              value={display.completedByRecency}
              onChange={(value) => set("completedByRecency", value)}
              size="md"
            />
          </Row>
        </div>
        <div className="space-y-2 border-t border-subtle p-4">
          <Row label="Completed tasks">
            <Select
              aria-label="Completed tasks"
              value={display.completed}
              onValueChange={(value) => set("completed", value as TTaskDisplay["completed"])}
              options={COMPLETED_OPTIONS}
              className="h-8 w-40"
            />
          </Row>
          <Row label="Show sub-tasks">
            <Switch
              label="Show sub-tasks"
              value={display.showSubIssues}
              onChange={(value) => set("showSubIssues", value)}
              size="md"
            />
          </Row>
          <Row label="Show empty groups">
            <Switch
              label="Show empty groups"
              value={display.showEmptyGroups}
              disabled={display.grouping === "none"}
              onChange={(value) => set("showEmptyGroups", value)}
              size="md"
            />
          </Row>
        </div>
        <div className="border-t border-subtle p-4">
          <p className="mb-2 text-secondary">Display properties</p>
          <div className="flex flex-wrap gap-1.5">
            {PROPERTY_OPTIONS.map((property) => {
              const selected = display.properties.includes(property.value);
              return (
                <Chip
                  key={property.value}
                  selected={selected}
                  className="h-7 px-2.5 text-12"
                  onClick={() =>
                    set(
                      "properties",
                      selected
                        ? display.properties.filter((value) => value !== property.value)
                        : [...display.properties, property.value]
                    )
                  }
                >
                  {property.label}
                </Chip>
              );
            })}
          </div>
        </div>
        {!isDefault && (
          <div className="flex justify-end border-t border-subtle px-4 py-2">
            <button
              type="button"
              onClick={() => props.onChange(DEFAULT_TASK_DISPLAY)}
              className="rounded-md px-2 py-1 text-12 text-secondary hover:bg-layer-transparent-hover hover:text-primary focus-visible:outline-2 focus-visible:outline-accent-strong focus-visible:outline-solid"
            >
              Reset to default
            </button>
          </div>
        )}
      </Popover.Panel>
    </Popover>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3">
      <span className="text-secondary">{label}</span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}
