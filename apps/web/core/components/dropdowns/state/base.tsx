/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { StateGroupIcon } from "@plane/propel/icons";
import type { IState } from "@plane/types";
import { ComboDropDown } from "@plane/ui";
import { cn } from "@plane/utils";
// components
import type { TDropdownProps } from "@/components/dropdowns/types";
// hooks
import { useDropdown } from "@/hooks/use-dropdown";
import { StateDropdownOptions, StateDropdownTrigger } from "./state-dropdown-parts";

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

  const selectedState = stateValue ? getStateById(stateValue) : undefined;

  const dropdownOnChange = (val: string) => {
    onChange(val);
  };

  const comboButton = (
    <StateDropdownTrigger
      button={button}
      buttonClassName={buttonClassName}
      buttonContainerClassName={buttonContainerClassName}
      buttonVariant={buttonVariant}
      disabled={disabled}
      dropdownArrow={dropdownArrow}
      dropdownArrowClassName={dropdownArrowClassName}
      icon={
        <StateGroupIcon
          stateGroup={selectedState?.group ?? "backlog"}
          color={selectedState?.color ?? "var(--text-color-tertiary)"}
          className={cn("flex-shrink-0", iconSize)}
          percentage={selectedState?.order}
        />
      }
      hideIcon={hideIcon}
      isActive={isOpen}
      isInitializing={isInitializing}
      renderByDefault={renderByDefault}
      selectedStateName={selectedState?.name}
      showTooltip={showTooltip}
      tabIndex={tabIndex}
    />
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
      <StateDropdownOptions
        query={query}
        onQueryChange={setQuery}
        options={options}
        optionProps={{ ...props, selectedValue: value }}
      />
    </ComboDropDown>
  );
});
