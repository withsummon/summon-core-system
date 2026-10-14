/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useEffect, useState } from "react";
import type { TPlacement as Placement } from "@plane/propel/utils";
import { observer } from "mobx-react";
import { ArrowRight, CalendarDays } from "lucide-react";
import { Popover, POPUP_CLASSNAME } from "@plane/propel/popover";
// plane imports
import { useTranslation } from "@plane/i18n";
// ui
import type { DateRange, Matcher } from "@plane/propel/calendar";
import { Calendar } from "@plane/propel/calendar";
import { CloseIcon, DueDatePropertyIcon } from "@plane/propel/icons";
import { cn, renderFormattedDate } from "@plane/utils";
// helpers
// hooks
import { useUserProfile } from "@/hooks/store/user";
import { useDropdown } from "@/hooks/use-dropdown";
// components
import { DropdownButton } from "./buttons";
import { MergedDateDisplay } from "./merged-date";
// types
import type { TButtonVariants } from "./types";

type Props = {
  applyButtonText?: string;
  bothRequired?: boolean;
  buttonClassName?: string;
  buttonContainerClassName?: string;
  buttonFromDateClassName?: string;
  buttonToDateClassName?: string;
  buttonVariant: TButtonVariants;
  cancelButtonText?: string;
  className?: string;
  clearIconClassName?: string;
  disabled?: boolean;
  hideIcon?: {
    from?: boolean;
    to?: boolean;
  };
  isClearable?: boolean;
  mergeDates?: boolean;
  minDate?: Date;
  maxDate?: Date;
  onSelect?: (range: DateRange | undefined) => void;
  placeholder?: {
    from?: string;
    to?: string;
  };
  placement?: Placement;
  required?: boolean;
  showTooltip?: boolean;
  tabIndex?: number;
  value: {
    from: Date | undefined;
    to: Date | undefined;
  };
  renderByDefault?: boolean;
  renderPlaceholder?: boolean;
  customTooltipContent?: React.ReactNode;
  customTooltipHeading?: string;
  defaultOpen?: boolean;
  renderInPortal?: boolean;
};

function DateRangeTooltipContent({ dateRange }: { dateRange: DateRange }) {
  return (
    <>
      {dateRange.from ? renderFormattedDate(dateRange.from) : ""}
      {dateRange.from && dateRange.to ? " - " : ""}
      {dateRange.to ? renderFormattedDate(dateRange.to) : ""}
    </>
  );
}

function ClearDatesIcon({ className, onClear }: { className: string; onClear: () => void }) {
  return (
    <CloseIcon
      className={cn("h-2.5 w-2.5 flex-shrink-0 cursor-pointer", className)}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClear();
      }}
    />
  );
}

type TDateRangeButtonContentProps = {
  dateRange: DateRange;
  mergeDates: boolean | undefined;
  hideIcon: { from?: boolean; to?: boolean };
  placeholder: { from?: string; to?: string };
  renderPlaceholder: boolean;
  buttonFromDateClassName: string | undefined;
  buttonToDateClassName: string | undefined;
  clearIconClassName: string;
  /** Present only when the clear icon should render. */
  onClear: (() => void) | undefined;
};

function MergedDateRangeContent(props: TDateRangeButtonContentProps) {
  const { dateRange, hideIcon, placeholder, renderPlaceholder, clearIconClassName, onClear } = props;
  return (
    <div className="flex w-full items-center gap-1.5">
      {!hideIcon.from && <CalendarDays className="h-3 w-3 flex-shrink-0" />}
      {dateRange.from || dateRange.to ? (
        <MergedDateDisplay startDate={dateRange.from} endDate={dateRange.to} className="flex-grow truncate text-11" />
      ) : (
        renderPlaceholder && (
          <>
            <span className="text-placeholder">{placeholder.from}</span>
            {placeholder.from && placeholder.to && <ArrowRight className="h-3 w-3 flex-shrink-0 text-placeholder" />}
            <span className="text-placeholder">{placeholder.to}</span>
          </>
        )
      )}
      {onClear && <ClearDatesIcon className={clearIconClassName} onClear={onClear} />}
    </div>
  );
}

function SeparateDateRangeContent(props: TDateRangeButtonContentProps) {
  const {
    dateRange,
    hideIcon,
    placeholder,
    renderPlaceholder,
    buttonFromDateClassName,
    buttonToDateClassName,
    clearIconClassName,
    onClear,
  } = props;
  const fromLabel = dateRange.from ? renderFormattedDate(dateRange.from) : renderPlaceholder ? placeholder.from : "";
  const toLabel = dateRange.to ? renderFormattedDate(dateRange.to) : renderPlaceholder ? placeholder.to : "";
  return (
    <>
      <span
        className={cn("flex h-full flex-grow items-center justify-center gap-1 rounded-xs", buttonFromDateClassName)}
      >
        {!hideIcon.from && <CalendarDays className="h-3 w-3 flex-shrink-0" />}
        {fromLabel}
      </span>
      <ArrowRight className="h-3 w-3 flex-shrink-0" />
      <span className={cn("flex h-full flex-grow items-center justify-center gap-1 rounded-xs", buttonToDateClassName)}>
        {!hideIcon.to && <DueDatePropertyIcon className="h-3 w-3 flex-shrink-0" />}
        {toLabel}
      </span>
      {onClear && <ClearDatesIcon className={cn("ml-1", clearIconClassName)} onClear={onClear} />}
    </>
  );
}

function DateRangeButtonContent(props: TDateRangeButtonContentProps) {
  return props.mergeDates ? <MergedDateRangeContent {...props} /> : <SeparateDateRangeContent {...props} />;
}

export const DateRangeDropdown = observer(function DateRangeDropdown(props: Props) {
  const { t } = useTranslation();
  const {
    buttonClassName,
    buttonContainerClassName,
    buttonFromDateClassName,
    buttonToDateClassName,
    buttonVariant,
    className,
    clearIconClassName = "",
    disabled = false,
    hideIcon = {
      from: true,
      to: true,
    },
    isClearable = false,
    mergeDates,
    minDate,
    maxDate,
    onSelect,
    placeholder = {
      from: t("project_cycles.add_date"),
      to: t("project_cycles.add_date"),
    },
    placement,
    showTooltip = false,
    tabIndex,
    value,
    renderByDefault = true,
    renderPlaceholder = true,
    customTooltipContent,
    customTooltipHeading,
    defaultOpen = false,
    renderInPortal = false,
  } = props;
  // states
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [dateRange, setDateRange] = useState<DateRange>(value);
  // hooks
  const { data } = useUserProfile();
  const startOfWeek = data?.start_of_the_week;

  const { handleOpenChange } = useDropdown({ setIsOpen });

  const disabledDays: Matcher[] = [];
  if (minDate) disabledDays.push({ before: minDate });
  if (maxDate) disabledDays.push({ after: maxDate });

  const clearDates = () => {
    const clearedRange = { from: undefined, to: undefined };
    setDateRange(clearedRange);
    onSelect?.(clearedRange);
  };

  const hasDisplayedDates = dateRange.from || dateRange.to;

  useEffect(() => {
    setDateRange(value);
  }, [value]);

  const trigger = (
    <button
      type="button"
      className={cn(
        "clickable block h-full max-w-full outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-strong focus-visible:outline-solid",
        {
          "cursor-not-allowed text-secondary": disabled,
          "cursor-pointer": !disabled,
        },
        buttonContainerClassName
      )}
      disabled={disabled}
    >
      <DropdownButton
        className={buttonClassName}
        isActive={isOpen}
        tooltipHeading={customTooltipHeading ?? t("project_cycles.date_range")}
        tooltipContent={customTooltipContent ?? <DateRangeTooltipContent dateRange={dateRange} />}
        showTooltip={showTooltip}
        variant={buttonVariant}
        renderToolTipByDefault={renderByDefault}
      >
        <DateRangeButtonContent
          dateRange={dateRange}
          mergeDates={mergeDates}
          hideIcon={hideIcon}
          placeholder={placeholder}
          renderPlaceholder={renderPlaceholder}
          buttonFromDateClassName={buttonFromDateClassName}
          buttonToDateClassName={buttonToDateClassName}
          clearIconClassName={clearIconClassName}
          onClear={isClearable && !disabled && hasDisplayedDates ? clearDates : undefined}
        />
      </DropdownButton>
    </button>
  );

  return (
    <div className={cn("h-full", className)}>
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <Popover.Button render={trigger} disabled={disabled} tabIndex={tabIndex} />
        <Popover.Panel
          placement={placement ?? "bottom-start"}
          sideOffset={4}
          positionerClassName="z-[120]"
          renderInPortal={renderInPortal}
          data-prevent-outside-click
          className={cn(POPUP_CLASSNAME, "overflow-hidden p-0")}
        >
          <Calendar
            className="p-3 text-12"
            captionLayout="dropdown"
            selected={dateRange}
            onSelect={(val: DateRange | undefined) => onSelect?.(val)}
            mode="range"
            disabled={disabledDays}
            showOutsideDays
            fixedWeeks
            weekStartsOn={startOfWeek}
            initialFocus
          />
        </Popover.Panel>
      </Popover>
    </div>
  );
});
