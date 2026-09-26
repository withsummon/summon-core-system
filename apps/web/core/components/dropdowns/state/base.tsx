/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { useState } from "react";
import { observer } from "mobx-react";
import { ComboboxPrimitive as Combobox } from "@plane/propel/combobox";
// plane imports
import { useTranslation } from "@plane/i18n";
import { SearchIcon, StateGroupIcon, ChevronDownIcon } from "@plane/propel/icons";
import type { IState } from "@plane/types";
import { ComboDropDown, Spinner } from "@plane/ui";
import { cn } from "@plane/utils";
// components
import { DropdownButton } from "@/components/dropdowns/buttons";
import { BUTTON_VARIANTS_WITH_TEXT } from "@/components/dropdowns/constants";
import type { TDropdownProps } from "@/components/dropdowns/types";
// hooks
import { useDropdown } from "@/hooks/use-dropdown";
// plane web imports
import { StateOption } from "@/components/workflow";

export type TWorkItemStateDropdownBaseProps = TDropdownProps & {
  alwaysAllowStateChange?: boolean;
  button?: ReactNode;
  dropdownArrow?: boolean;
  dropdownArrowClassName?: string;
  filterAvailableStateIds?: boolean;
  getStateById: (stateId: string | null | undefined) => IState | undefined;
  iconSize?: string;
  isForWorkItemCreation?: boolean;
  isInitializing?: boolean;
  onChange: (val: string) => void;
  onClose?: () => void;
  onDropdownOpen?: () => void;
  projectId: string | undefined;
  renderByDefault?: boolean;
  showDefaultState?: boolean;
  stateIds: string[];
  value: string | undefined | null;
};

export const WorkItemStateDropdownBase = observer(function WorkItemStateDropdownBase(
  props: TWorkItemStateDropdownBaseProps
) {
  const {
    button,
    buttonClassName,
    buttonContainerClassName,
    buttonVariant,
    className = "",
    disabled = false,
    dropdownArrow = false,
    dropdownArrowClassName = "",
    getStateById,
    hideIcon = false,
    iconSize = "size-4",
    isInitializing = false,
    onChange,
    onClose,
    onDropdownOpen,
    placement,
    renderByDefault = true,
    showDefaultState = true,
    showTooltip = false,
    stateIds,
    tabIndex,
    value,
  } = props;
  // refs

  // states
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  // store hooks
  const { t } = useTranslation();
  const statesList = stateIds.map((stateId) => getStateById(stateId)).filter((state) => !!state);
  const defaultState = statesList?.find((state) => state?.default);
  const stateValue = value ? value : showDefaultState ? defaultState?.id : undefined;

  // dropdown init
  const { handleOpenChange } = useDropdown({ onClose, onOpen: onDropdownOpen, setIsOpen, setQuery });

  // derived values
  const options = statesList?.map((state) => ({
    value: state?.id,
    query: `${state?.name}`,
    content: (
      <div className="flex items-center gap-2">
        <StateGroupIcon
          stateGroup={state?.group ?? "backlog"}
          color={state?.color}
          className={cn("flex-shrink-0", iconSize)}
          percentage={state?.order}
        />
        <span className="flex-grow truncate text-left">{state?.name}</span>
      </div>
    ),
  }));

  const filteredOptions =
    query === "" ? options : options?.filter((o) => o.query.toLowerCase().includes(query.toLowerCase()));

  const selectedState = stateValue ? getStateById(stateValue) : undefined;

  const dropdownOnChange = (val: string) => {
    onChange(val);
  };

  const comboButton = button ? (
    <button
      type="button"
      className={cn("clickable block h-full w-full outline-none", buttonContainerClassName)}
      disabled={disabled}
      tabIndex={tabIndex}
    >
      {button}
    </button>
  ) : (
    <button
      tabIndex={tabIndex}
      type="button"
      className={cn(
        "clickable block h-full max-w-full outline-none",
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
        tooltipHeading={t("state")}
        tooltipContent={selectedState?.name ?? t("state")}
        showTooltip={showTooltip}
        variant={buttonVariant}
        renderToolTipByDefault={renderByDefault}
      >
        {isInitializing ? (
          <Spinner className="h-3.5 w-3.5" />
        ) : (
          <>
            {!hideIcon && (
              <StateGroupIcon
                stateGroup={selectedState?.group ?? "backlog"}
                color={selectedState?.color ?? "var(--text-color-tertiary)"}
                className={cn("flex-shrink-0", iconSize)}
                percentage={selectedState?.order}
              />
            )}
            {BUTTON_VARIANTS_WITH_TEXT.includes(buttonVariant) && (
              <span className="flex-grow truncate text-left">{selectedState?.name ?? t("state")}</span>
            )}
            {dropdownArrow && (
              <ChevronDownIcon className={cn("h-2.5 w-2.5 flex-shrink-0", dropdownArrowClassName)} aria-hidden="true" />
            )}
          </>
        )}
      </DropdownButton>
    </button>
  );

  return (
    // oxlint-disable-next-line jsx_a11y/no-static-element-interactions
    <ComboDropDown
      open={isOpen}
      className={cn("h-full", className)}
      value={stateValue}
      onChange={dropdownOnChange}
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
                placeholder={t("common.search.label")}
              />
            </div>
            <Combobox.List className="mt-2 max-h-48 space-y-1 overflow-y-scroll">
              {filteredOptions ? (
                filteredOptions.length > 0 ? (
                  filteredOptions.map((option) => (
                    <StateOption
                      {...props}
                      key={option.value}
                      option={option}
                      selectedValue={value}
                      className="flex w-full cursor-pointer items-center justify-between gap-2 truncate rounded-sm px-1 py-1.5 select-none"
                    />
                  ))
                ) : (
                  <p className="px-1.5 py-1 text-placeholder italic">{t("no_matching_results")}</p>
                )
              ) : (
                <p className="px-1.5 py-1 text-placeholder italic">{t("loading")}</p>
              )}
            </Combobox.List>
          </div>
        </div>
      )}
    </ComboDropDown>
  );
});
