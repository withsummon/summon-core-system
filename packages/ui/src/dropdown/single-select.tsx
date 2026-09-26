/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ComboboxPrimitive as Combobox } from "@plane/propel/combobox";
import { convertPlacementToSideAndAlign } from "@plane/propel/utils";
import { sortBy } from "lodash-es";
import React, { useMemo, useState } from "react";
// plane imports
// local imports
import { cn } from "../utils";
import { DropdownButton } from "./common";
import { DropdownOptions } from "./common/options";
import type { ISingleSelectDropdown } from "./dropdown";

export function Dropdown(props: ISingleSelectDropdown) {
  const {
    value,
    onChange,
    options,
    onOpen,
    onClose,
    containerClassName,
    tabIndex,
    placement,
    disabled,
    buttonContent,
    buttonContainerClassName,
    buttonClassName,
    disableSearch,
    inputPlaceholder,
    inputClassName,
    inputIcon,
    inputContainerClassName,
    keyExtractor,
    optionsContainerClassName,
    queryArray,
    sortByKey,
    firstItem,
    renderItem,
    loader = false,
    disableSorting,
  } = props;

  // states
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { side, align } = convertPlacementToSideAndAlign(placement ?? "bottom-start");
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) onOpen?.();
    else {
      onClose?.();
      setQuery("");
    }
  };
  // options
  const sortedOptions = useMemo(() => {
    if (!options) return undefined;

    const filteredOptions = queryArray
      ? options.filter((option) => {
          const queryString = queryArray.map((field) => option.data[field]).join(" ");
          return queryString.toLowerCase().includes(query.toLowerCase());
        })
      : options;

    if (disableSorting || !sortByKey) return filteredOptions;

    return sortBy(filteredOptions, [
      (option) => firstItem && firstItem(option.data[option.value]),
      (option) => !(value ?? []).includes(option.data[option.value]),
      () => sortByKey && sortByKey.toLowerCase(),
    ]);
  }, [query, options, queryArray, disableSorting, sortByKey, firstItem, value]);

  return (
    <Combobox.Root
      value={value}
      onValueChange={onChange}
      multiple={false}
      open={isOpen}
      onOpenChange={handleOpenChange}
      inputValue={query}
      onInputValueChange={setQuery}
      filter={null}
      disabled={disabled}
    >
      <div
        className={cn(
          "h-full",
          typeof containerClassName === "function" ? containerClassName(isOpen) : containerClassName
        )}
      >
        <DropdownButton
          value={value}
          isOpen={isOpen}
          tabIndex={tabIndex}
          buttonContent={buttonContent}
          buttonClassName={buttonClassName}
          buttonContainerClassName={buttonContainerClassName}
          disabled={disabled}
        />
      </div>
      <Combobox.Portal>
        <Combobox.Positioner side={side} align={align} sideOffset={4} collisionPadding={12} className="z-[120]">
          <Combobox.Popup
            className={cn(
              "w-48 rounded-md border border-strong bg-surface-1 p-2 text-11 shadow-raised-200 outline-none",
              optionsContainerClassName
            )}
          >
            <DropdownOptions
              isOpen={isOpen}
              query={query}
              setQuery={setQuery}
              inputIcon={inputIcon}
              inputPlaceholder={inputPlaceholder}
              inputClassName={inputClassName}
              inputContainerClassName={inputContainerClassName}
              disableSearch={disableSearch}
              keyExtractor={keyExtractor}
              options={sortedOptions}
              value={value}
              renderItem={renderItem}
              loader={loader}
            />
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
