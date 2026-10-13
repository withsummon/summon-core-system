/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef, useState } from "react";
import { SignalHigh } from "lucide-react";
import { ISSUE_PRIORITIES } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
// types
import { PriorityIcon, ChevronDownIcon } from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";
import type { TIssuePriorities } from "@plane/types";
// ui
import { ComboDropDown } from "@plane/ui";
// helpers
import { cn } from "@plane/utils";
// hooks
import { useDropdown } from "@/hooks/use-dropdown";
import { usePlatformOS } from "@/hooks/use-platform-os";
// constants
import { BACKGROUND_BUTTON_VARIANTS, BORDER_BUTTON_VARIANTS, BUTTON_VARIANTS_WITHOUT_TEXT } from "./constants";
// types
import type { TDropdownProps } from "./types";
import { filterOptionsByQuery, SearchableOptionsPanel } from "./searchable-options-panel";

type Props = TDropdownProps & {
  button?: ReactNode;
  dropdownArrow?: boolean;
  dropdownArrowClassName?: string;
  highlightUrgent?: boolean;
  onChange: (val: TIssuePriorities) => void;
  onClose?: () => void;
  value: TIssuePriorities | undefined | null;
  renderByDefault?: boolean;
};

type ButtonProps = {
  className?: string;
  dropdownArrow: boolean;
  dropdownArrowClassName: string;
  hideIcon?: boolean;
  hideText?: boolean;
  isActive?: boolean;
  highlightUrgent: boolean;
  placeholder: string;
  priority: TIssuePriorities | undefined;
  showTooltip: boolean;
  renderToolTipByDefault?: boolean;
};

type TPriorityButtonContentProps = {
  priority: TIssuePriorities | undefined;
  hideIcon: boolean;
  hideText: boolean;
  highlightUrgent: boolean;
  label: ReactNode;
  dropdownArrow: boolean;
  dropdownArrowClassName: string;
};

/** Icon, label and arrow shared by every priority button variant. */
function PriorityButtonContent(props: TPriorityButtonContentProps) {
  const { priority, hideIcon, hideText, highlightUrgent, label, dropdownArrow, dropdownArrowClassName } = props;
  return (
    <>
      {!hideIcon &&
        (priority ? (
          <div
            className={cn({
              // highlight just the icon if text is visible and priority is urgent
              "rounded-sm border border-priority-urgent p-0.5": priority === "urgent" && !hideText && highlightUrgent,
            })}
          >
            <PriorityIcon
              priority={priority}
              size={12}
              className={cn("flex-shrink-0", {
                // increase the icon size if text is hidden
                "h-3.5 w-3.5": hideText,
                // centre align the icons if text is hidden
                "translate-x-[0.0625rem]": hideText && priority === "high",
                "translate-x-0.5": hideText && priority === "medium",
                "translate-x-1": hideText && priority === "low",
                // highlight the icon if priority is urgent
              })}
            />
          </div>
        ) : (
          <SignalHigh className="size-3" />
        ))}
      {!hideText && (
        <span
          className={cn("flex-grow truncate text-body-xs-medium", {
            "text-secondary": priority && priority !== "none",
            "text-placeholder": !priority || priority === "none",
          })}
        >
          {label}
        </span>
      )}
      {dropdownArrow && (
        <ChevronDownIcon className={cn("h-2.5 w-2.5 flex-shrink-0", dropdownArrowClassName)} aria-hidden="true" />
      )}
    </>
  );
}

function BorderButton(props: ButtonProps) {
  const {
    className,
    dropdownArrow,
    dropdownArrowClassName,
    hideIcon = false,
    hideText = false,
    highlightUrgent,
    placeholder,
    priority,
    showTooltip,
    renderToolTipByDefault = true,
  } = props;

  const priorityDetails = ISSUE_PRIORITIES.find((p) => p.key === priority);

  const priorityClasses = {
    urgent: "bg-layer-2 border-priority-urgent px-1",
    high: "bg-layer-2 border-priority-high",
    medium: "bg-layer-2 border-priority-medium",
    low: "bg-layer-2 border-priority-low",
    none: "bg-layer-2 border-strong",
  };

  const { isMobile } = usePlatformOS();
  const { t } = useTranslation();

  return (
    <Tooltip
      tooltipHeading={t("priority")}
      tooltipContent={priorityDetails?.title ?? t("common.none")}
      disabled={!showTooltip}
      isMobile={isMobile}
      renderByDefault={renderToolTipByDefault}
    >
      <div
        className={cn(
          "flex h-full items-center gap-1.5 rounded-sm border-[0.5px] px-2 py-0.5",
          priorityClasses[priority ?? "none"],
          {
            // compact the icons if text is hidden
            "px-0.5": hideText,
            // highlight the whole button if text is hidden and priority is urgent
            "border-priority-urgent": priority === "urgent" && hideText && highlightUrgent,
          },
          className
        )}
      >
        <PriorityButtonContent
          priority={priority}
          hideIcon={hideIcon}
          hideText={hideText}
          highlightUrgent={highlightUrgent}
          label={priorityDetails?.title ?? placeholder}
          dropdownArrow={dropdownArrow}
          dropdownArrowClassName={dropdownArrowClassName}
        />
      </div>
    </Tooltip>
  );
}

function BackgroundButton(props: ButtonProps) {
  const {
    className,
    dropdownArrow,
    dropdownArrowClassName,
    hideIcon = false,
    hideText = false,
    highlightUrgent,
    placeholder,
    priority,
    showTooltip,
    renderToolTipByDefault = true,
  } = props;

  const priorityDetails = ISSUE_PRIORITIES.find((p) => p.key === priority);

  const priorityClasses = {
    urgent: "bg-layer-2",
    high: "bg-layer-2",
    medium: "bg-layer-2",
    low: "bg-layer-2",
    none: "bg-layer-2",
  };

  const { isMobile } = usePlatformOS();
  const { t } = useTranslation();

  return (
    <Tooltip
      tooltipHeading={t("priority")}
      tooltipContent={t(priorityDetails?.key ?? "none")}
      disabled={!showTooltip}
      isMobile={isMobile}
      renderByDefault={renderToolTipByDefault}
    >
      <div
        className={cn(
          "flex h-full items-center gap-1.5 rounded-sm px-2 py-0.5",
          priorityClasses[priority ?? "none"],
          {
            // compact the icons if text is hidden
            "px-0.5": hideText,
            // highlight the whole button if text is hidden and priority is urgent
            "border-priority-urgent": priority === "urgent" && hideText && highlightUrgent,
          },
          className
        )}
      >
        <PriorityButtonContent
          priority={priority}
          hideIcon={hideIcon}
          hideText={hideText}
          highlightUrgent={highlightUrgent}
          label={priorityDetails?.title ?? t("common.priority") ?? placeholder}
          dropdownArrow={dropdownArrow}
          dropdownArrowClassName={dropdownArrowClassName}
        />
      </div>
    </Tooltip>
  );
}

function TransparentButton(props: ButtonProps) {
  const {
    className,
    dropdownArrow,
    dropdownArrowClassName,
    hideIcon = false,
    hideText = false,
    isActive = false,
    highlightUrgent,
    placeholder,
    priority,
    showTooltip,
    renderToolTipByDefault = true,
  } = props;

  const priorityDetails = ISSUE_PRIORITIES.find((p) => p.key === priority);

  const { isMobile } = usePlatformOS();
  const { t } = useTranslation();

  return (
    <Tooltip
      tooltipHeading={t("priority")}
      tooltipContent={priorityDetails?.title ?? t("common.none")}
      disabled={!showTooltip}
      isMobile={isMobile}
      renderByDefault={renderToolTipByDefault}
    >
      <div
        className={cn(
          "flex h-full w-full items-center gap-1.5 rounded-sm px-2 hover:bg-layer-transparent-hover",
          {
            // compact the icons if text is hidden
            "px-0.5": hideText,
            // highlight the whole button if text is hidden and priority is urgent
            "border-priority-urgent": priority === "urgent" && hideText && highlightUrgent,
            "bg-layer-1": isActive,
          },
          className
        )}
      >
        <PriorityButtonContent
          priority={priority}
          hideIcon={hideIcon}
          hideText={hideText}
          highlightUrgent={highlightUrgent}
          label={priorityDetails?.title ?? t("common.priority") ?? placeholder}
          dropdownArrow={dropdownArrow}
          dropdownArrowClassName={dropdownArrowClassName}
        />
      </div>
    </Tooltip>
  );
}

const PRIORITY_OPTIONS = ISSUE_PRIORITIES.map((priority) => ({
  value: priority.key,
  query: priority.key,
  content: (
    <div className="flex items-center gap-2">
      <PriorityIcon priority={priority.key} size={14} withContainer />
      <span className="flex-grow truncate">{priority.title}</span>
    </div>
  ),
}));

function PriorityOptionsPanel({ query, onQueryChange }: { query: string; onQueryChange: (query: string) => void }) {
  const { t } = useTranslation();
  return (
    <SearchableOptionsPanel
      query={query}
      onQueryChange={onQueryChange}
      options={filterOptionsByQuery(PRIORITY_OPTIONS, query)}
      searchPlaceholder={t("search")}
      noResultsLabel={t("no_matching_results")}
    />
  );
}

type TPriorityComboButtonProps = Pick<
  Props,
  | "button"
  | "buttonClassName"
  | "buttonContainerClassName"
  | "buttonVariant"
  | "tabIndex"
  | "showTooltip"
  | "renderByDefault"
> & {
  disabled: boolean;
  dropdownArrow: boolean;
  dropdownArrowClassName: string;
  hideIcon: boolean;
  highlightUrgent: boolean;
  placeholder: string;
  value: TIssuePriorities | null;
};

/** Base UI renders the trigger through `render`, so it forwards the ref and the trigger props onto its button. */
const PriorityComboButton = forwardRef<
  HTMLButtonElement,
  TPriorityComboButtonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof TPriorityComboButtonProps>
>(function PriorityComboButton(props, ref) {
  const {
    button,
    buttonClassName,
    buttonContainerClassName,
    buttonVariant,
    disabled,
    dropdownArrow,
    dropdownArrowClassName,
    hideIcon,
    highlightUrgent,
    placeholder,
    showTooltip = false,
    tabIndex,
    value,
    renderByDefault = true,
    ...triggerProps
  } = props;

  if (button) {
    return (
      <button
        {...triggerProps}
        ref={ref}
        type="button"
        className={cn(
          "clickable block h-full w-full outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-strong focus-visible:outline-solid",
          buttonContainerClassName
        )}
        disabled={disabled}
        tabIndex={tabIndex}
      >
        {button}
      </button>
    );
  }

  const ButtonToRender = BORDER_BUTTON_VARIANTS.includes(buttonVariant)
    ? BorderButton
    : BACKGROUND_BUTTON_VARIANTS.includes(buttonVariant)
      ? BackgroundButton
      : TransparentButton;

  return (
    <button
      {...triggerProps}
      ref={ref}
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
      tabIndex={tabIndex}
    >
      <ButtonToRender
        priority={value ?? undefined}
        className={buttonClassName}
        highlightUrgent={highlightUrgent}
        dropdownArrow={dropdownArrow && !disabled}
        dropdownArrowClassName={dropdownArrowClassName}
        hideIcon={hideIcon}
        placeholder={placeholder}
        showTooltip={showTooltip}
        hideText={BUTTON_VARIANTS_WITHOUT_TEXT.includes(buttonVariant)}
        renderToolTipByDefault={renderByDefault}
      />
    </button>
  );
});

export function PriorityDropdown(props: Props) {
  //hooks
  const { t } = useTranslation();
  const {
    button,
    buttonClassName,
    buttonContainerClassName,
    buttonVariant,
    className = "",
    disabled = false,
    dropdownArrow = false,
    dropdownArrowClassName = "",
    hideIcon = false,
    highlightUrgent = true,
    onChange,
    onClose,
    placeholder = t("common.priority"),
    placement,
    showTooltip = false,
    tabIndex,
    value = "none",
    renderByDefault = true,
  } = props;
  // states
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  // refs

  const dropdownOnChange = (val: TIssuePriorities) => {
    onChange(val);
  };

  const { handleOpenChange } = useDropdown({ onClose, setIsOpen, setQuery });

  const comboButton = (
    <PriorityComboButton
      button={button}
      buttonClassName={buttonClassName}
      buttonContainerClassName={buttonContainerClassName}
      buttonVariant={buttonVariant}
      disabled={disabled}
      dropdownArrow={dropdownArrow}
      dropdownArrowClassName={dropdownArrowClassName}
      hideIcon={hideIcon}
      highlightUrgent={highlightUrgent}
      placeholder={placeholder}
      showTooltip={showTooltip}
      tabIndex={tabIndex}
      value={value}
      renderByDefault={renderByDefault}
    />
  );

  return (
    <ComboDropDown
      open={isOpen}
      className={cn(
        "h-full",
        {
          "bg-layer-1": isOpen,
        },
        className
      )}
      value={value}
      onChange={dropdownOnChange}
      disabled={disabled}
      button={comboButton}
      placement={placement}
      onOpenChange={handleOpenChange}
    >
      <PriorityOptionsPanel query={query} onQueryChange={setQuery} />
    </ComboDropDown>
  );
}
