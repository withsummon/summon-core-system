/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { observer } from "mobx-react";
import { ComboboxPrimitive as Combobox } from "@plane/propel/combobox";
import { useTranslation } from "@plane/i18n";
import { SearchIcon, ChevronDownIcon } from "@plane/propel/icons";
import { POPUP_SEARCH_CLASSNAME, POPUP_SEARCH_INPUT_CLASSNAME } from "@plane/propel/popover";
import { Spinner } from "@plane/ui";
import { cn } from "@plane/utils";
// components
import { DropdownButton } from "@/components/dropdowns/buttons";
import { BUTTON_VARIANTS_WITH_TEXT } from "@/components/dropdowns/constants";
import type { TButtonVariants } from "@/components/dropdowns/types";
import { StateOption } from "@/components/workflow";
import type { TStateOptionProps } from "@/components/workflow/state-option";

type TStateDropdownTriggerProps = {
  button?: ReactNode;
  buttonClassName?: string;
  buttonContainerClassName?: string;
  buttonVariant: TButtonVariants;
  disabled: boolean;
  dropdownArrow: boolean;
  dropdownArrowClassName: string;
  /** Rendered unless `hideIcon` is set. */
  icon: ReactNode;
  hideIcon: boolean;
  isActive: boolean;
  isInitializing: boolean;
  renderByDefault: boolean;
  selectedStateName: string | undefined;
  showTooltip: boolean;
  tabIndex?: number;
};

/**
 * Combobox trigger shared by the work item and intake state dropdowns.
 * Base UI renders it through `render`, so it forwards the ref and the trigger props onto its button.
 */
export const StateDropdownTrigger = forwardRef<
  HTMLButtonElement,
  TStateDropdownTriggerProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof TStateDropdownTriggerProps>
>(function StateDropdownTrigger(props, ref) {
  const {
    button,
    buttonClassName,
    buttonContainerClassName,
    buttonVariant,
    disabled,
    dropdownArrow,
    dropdownArrowClassName,
    icon,
    hideIcon,
    isActive,
    isInitializing,
    renderByDefault,
    selectedStateName,
    showTooltip,
    tabIndex,
    ...triggerProps
  } = props;
  const { t } = useTranslation();

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

  return (
    <button
      {...triggerProps}
      ref={ref}
      tabIndex={tabIndex}
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
        isActive={isActive}
        tooltipHeading={t("state")}
        tooltipContent={selectedStateName ?? t("state")}
        showTooltip={showTooltip}
        variant={buttonVariant}
        renderToolTipByDefault={renderByDefault}
      >
        {isInitializing ? (
          <Spinner className="h-3.5 w-3.5" />
        ) : (
          <>
            {!hideIcon && icon}
            {BUTTON_VARIANTS_WITH_TEXT.includes(buttonVariant) && (
              <span className="flex-grow truncate text-left">{selectedStateName ?? t("state")}</span>
            )}
            {dropdownArrow && (
              <ChevronDownIcon className={cn("h-2.5 w-2.5 flex-shrink-0", dropdownArrowClassName)} aria-hidden="true" />
            )}
          </>
        )}
      </DropdownButton>
    </button>
  );
});

type TStateDropdownOptionsProps = {
  query: string;
  onQueryChange: (query: string) => void;
  options: TStateOptionProps["option"][];
  /** Forwarded to every `StateOption`. */
  optionProps: Omit<TStateOptionProps, "option">;
};

/** Search field and option list shared by the work item and intake state dropdowns. */
export const StateDropdownOptions = observer(function StateDropdownOptions(props: TStateDropdownOptionsProps) {
  const { query, onQueryChange, options, optionProps } = props;
  const { t } = useTranslation();
  const filteredOptions =
    query === "" ? options : options.filter((o) => o.query.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="z-10">
      <div className="w-56 max-w-[calc(100vw-2rem)]">
        <div className={POPUP_SEARCH_CLASSNAME}>
          <SearchIcon className="size-3.5 flex-none" />
          <Combobox.Input
            className={POPUP_SEARCH_INPUT_CLASSNAME}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t("common.search.label")}
          />
        </div>
        <Combobox.List className="max-h-60 overflow-y-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => <StateOption {...optionProps} key={option.value} option={option} />)
          ) : (
            <p className="px-2 py-1.5 text-placeholder">{t("no_matching_results")}</p>
          )}
        </Combobox.List>
      </div>
    </div>
  );
});
