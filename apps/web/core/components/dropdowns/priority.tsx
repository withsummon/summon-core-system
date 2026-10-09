/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { useState } from "react";
import { SignalHigh } from "lucide-react";
import { ComboboxPrimitive as Combobox } from "@plane/propel/combobox";
import { ISSUE_PRIORITIES } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
// types
import { CheckIcon, PriorityIcon, ChevronDownIcon, SearchIcon } from "@plane/propel/icons";
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
  hideIcon: boolean;
  hideText: boolean;
  highlightUrgent: boolean;
  placeholder: string;
  priority: TIssuePriorities | undefined;
  showTooltip: boolean;
  renderToolTipByDefault: boolean;
  buttonVariant: TDropdownProps["buttonVariant"];
};

const priorityBorders = {
  urgent: "border-priority-urgent px-1",
  high: "border-priority-high",
  medium: "border-priority-medium",
  low: "border-priority-low",
  none: "border-strong",
} satisfies Record<TIssuePriorities, string>;
const priorityIconOffset = {
  urgent: "",
  high: "translate-x-[0.0625rem]",
  medium: "translate-x-0.5",
  low: "translate-x-1",
  none: "",
} satisfies Record<TIssuePriorities, string>;

function PriorityButton({
  className,
  dropdownArrow,
  dropdownArrowClassName,
  hideIcon,
  hideText,
  highlightUrgent,
  placeholder,
  priority,
  showTooltip,
  renderToolTipByDefault,
  buttonVariant,
}: ButtonProps) {
  const priorityDetails = ISSUE_PRIORITIES.find((item) => item.key === priority);
  const title = priorityDetails?.title;
  const bordered = BORDER_BUTTON_VARIANTS.includes(buttonVariant);
  const background = BACKGROUND_BUTTON_VARIANTS.includes(buttonVariant);
  const raised = bordered || background;
  const urgent = priority === "urgent" && highlightUrgent;
  const { isMobile } = usePlatformOS();
  const { t } = useTranslation();
  return (
    <Tooltip
      tooltipHeading={t("priority")}
      tooltipContent={background ? t(priority ?? "none") : (title ?? t("common.none"))}
      disabled={!showTooltip}
      isMobile={isMobile}
      renderByDefault={renderToolTipByDefault}
    >
      <div
        className={cn(
          "flex h-full items-center gap-1.5 rounded-sm",
          raised ? "bg-layer-2 py-0.5" : "w-full hover:bg-layer-transparent-hover",
          "px-2",
          {
            "border-[0.5px]": bordered,
            [priorityBorders[priority ?? "none"]]: bordered,
            "px-0.5": hideText,
            "border-priority-urgent": urgent && hideText,
          },
          className
        )}
      >
        {!hideIcon &&
          (priority ? (
            <div className={cn({ "rounded-sm border border-priority-urgent p-0.5": urgent && !hideText })}>
              <PriorityIcon
                priority={priority}
                size={12}
                className={cn("flex-shrink-0", hideText && ["h-3.5 w-3.5", priorityIconOffset[priority]])}
              />
            </div>
          ) : (
            <SignalHigh className="size-3" />
          ))}
        {!hideText && (
          <span
            className={cn("flex-grow truncate text-body-xs-medium text-placeholder", {
              "text-secondary": priority && priority !== "none",
            })}
          >
            {title ?? placeholder}
          </span>
        )}
        {dropdownArrow && (
          <ChevronDownIcon className={cn("h-2.5 w-2.5 flex-shrink-0", dropdownArrowClassName)} aria-hidden="true" />
        )}
      </div>
    </Tooltip>
  );
}

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

  const options = ISSUE_PRIORITIES.map((priority) => ({
    value: priority.key,
    query: priority.key,
    content: (
      <div className="flex items-center gap-2">
        <PriorityIcon priority={priority.key} size={14} withContainer />
        <span className="flex-grow truncate">{priority.title}</span>
      </div>
    ),
  }));

  const filteredOptions =
    query === "" ? options : options.filter((o) => o.query.toLowerCase().includes(query.toLowerCase()));

  const { handleOpenChange } = useDropdown({ onClose, setIsOpen, setQuery });

  const comboButton = button ? (
    <button
      type="button"
      aria-label={t("common.priority")}
      className={cn("clickable block h-full w-full outline-none", buttonContainerClassName)}
      disabled={disabled}
      tabIndex={tabIndex}
    >
      {button}
    </button>
  ) : (
    <button
      type="button"
      aria-label={t("common.priority")}
      className={cn(
        "clickable block h-full max-w-full outline-none",
        {
          "cursor-not-allowed text-secondary": disabled,
          "cursor-pointer": !disabled,
        },
        buttonContainerClassName
      )}
      disabled={disabled}
      tabIndex={tabIndex}
    >
      <PriorityButton
        buttonVariant={buttonVariant}
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
      onChange={onChange}
      disabled={disabled}
      button={comboButton}
      placement={placement}
      onOpenChange={handleOpenChange}
    >
      {isOpen && (
        <div className="z-10">
          <div className="my-1 w-48 rounded-sm border-[0.5px] border-strong bg-surface-1 px-2 py-2.5 text-11 shadow-raised-200 focus:outline-none">
            <div className="flex items-center gap-1.5 rounded-sm border border-subtle bg-surface-2 px-2">
              <SearchIcon className="h-3.5 w-3.5 text-placeholder" strokeWidth={1.5} />
              <Combobox.Input
                className="w-full bg-transparent py-1 text-11 text-secondary placeholder:text-placeholder focus:outline-none"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("search")}
              />
            </div>
            <Combobox.List className="mt-2 max-h-48 space-y-1 overflow-y-scroll">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <Combobox.Item
                    key={option.value}
                    value={option.value}
                    className={({ highlighted: active, selected }) =>
                      cn(
                        `flex w-full cursor-pointer items-center justify-between gap-2 truncate rounded-sm px-1 py-1.5 select-none ${
                          active ? "bg-layer-transparent-hover" : ""
                        } ${selected ? "text-primary" : "text-secondary"}`
                      )
                    }
                    render={(itemProps, { selected }) => (
                      <div {...itemProps}>
                        {
                          <>
                            <span className="flex-grow truncate">{option.content}</span>
                            {selected && <CheckIcon className="h-3.5 w-3.5 flex-shrink-0" />}
                          </>
                        }
                      </div>
                    )}
                  ></Combobox.Item>
                ))
              ) : (
                <p className="px-1.5 py-1 text-placeholder italic">{t("no_matching_results")}</p>
              )}
            </Combobox.List>
          </div>
        </div>
      )}
    </ComboDropDown>
  );
}
