/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ComboboxPrimitive as Combobox } from "@plane/propel/combobox";
import { FIELD_CLASSNAME } from "@plane/propel/input";
import {
  POPUP_CLASSNAME,
  POPUP_OPTION_CLASSNAME,
  POPUP_SEARCH_CLASSNAME,
  POPUP_SEARCH_INPUT_CLASSNAME,
} from "@plane/propel/popover";
import { convertPlacementToSideAndAlign } from "@plane/propel/utils";
import { Info } from "lucide-react";
import { useState } from "react";
import { CheckIcon, SearchIcon, ChevronDownIcon } from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";
import { cn } from "../utils";
import type { ICustomSearchSelectProps } from "./helper";

export function CustomSearchSelect({
  customButtonClassName,
  buttonClassName,
  className,
  chevronClassName,
  customButton,
  render,
  placement = "bottom-start",
  disabled = false,
  footerOption,
  input = false,
  label,
  maxHeight = "md",
  multiple = false,
  noChevron = false,
  onChange,
  options,
  onOpen,
  onClose,
  optionsClassName,
  value,
  tabIndex,
  noResultsMessage = "No matches found",
  defaultOpen = false,
}: ICustomSearchSelectProps) {
  const [query, setQuery] = useState("");
  const { side, align } = convertPlacementToSideAndAlign(placement);
  const filteredOptions = options?.filter((option) => option.query.toLowerCase().includes(query.toLowerCase()));
  return (
    <Combobox.Root
      value={value}
      onValueChange={onChange}
      multiple={multiple}
      disabled={disabled}
      defaultOpen={defaultOpen}
      filter={null}
      inputValue={query}
      onInputValueChange={setQuery}
      onOpenChange={(open) => {
        if (open) onOpen?.();
        else {
          onClose?.();
          setQuery("");
        }
      }}
    >
      <div className={cn("relative flex-shrink-0 text-left", className)}>
        <Combobox.Trigger
          render={render}
          tabIndex={tabIndex}
          className={cn(
            "flex w-full items-center justify-between gap-2 outline-none disabled:cursor-not-allowed disabled:opacity-50",
            render || customButton
              ? [
                  "focus-visible:outline-2 focus-visible:outline-accent-strong focus-visible:outline-solid",
                  customButtonClassName,
                ]
              : [FIELD_CLASSNAME, input ? "h-9 px-3" : "h-8 px-2.5", buttonClassName]
          )}
        >
          {render ? undefined : (customButton ?? label)}
          {!render && !customButton && !noChevron && <ChevronDownIcon className={cn("size-3", chevronClassName)} />}
        </Combobox.Trigger>
      </div>
      <Combobox.Portal>
        <Combobox.Positioner side={side} align={align} sideOffset={4} className="z-[120]">
          <Combobox.Popup className={cn("min-w-[max(12rem,var(--anchor-width))]", POPUP_CLASSNAME, optionsClassName)}>
            <div className={POPUP_SEARCH_CLASSNAME}>
              <SearchIcon className="size-3.5 flex-none" />
              <Combobox.Input
                aria-label="Search options"
                placeholder="Search"
                className={POPUP_SEARCH_INPUT_CLASSNAME}
              />
            </div>
            <Combobox.List
              className={cn("overflow-y-auto", {
                "max-h-96": maxHeight === "2xl",
                "max-h-80": maxHeight === "xl",
                "max-h-60": maxHeight === "lg",
                "max-h-48": maxHeight === "md",
                "max-h-36": maxHeight === "rg",
                "max-h-28": maxHeight === "sm",
              })}
            >
              {filteredOptions ? (
                filteredOptions.length ? (
                  filteredOptions.map((option) => (
                    <Combobox.Item
                      key={option.value}
                      value={option.value}
                      disabled={option.disabled}
                      className={POPUP_OPTION_CLASSNAME}
                    >
                      <span className="min-w-0 flex-1 truncate">{option.content}</span>
                      <Combobox.ItemIndicator>
                        <CheckIcon className="size-3.5" />
                      </Combobox.ItemIndicator>
                      {option.tooltip &&
                        (typeof option.tooltip === "string" ? (
                          <Tooltip tooltipContent={option.tooltip}>
                            <Info className="size-3.5 text-secondary" />
                          </Tooltip>
                        ) : (
                          option.tooltip
                        ))}
                    </Combobox.Item>
                  ))
                ) : (
                  <p className="px-2 py-1.5 text-placeholder">{noResultsMessage}</p>
                )
              ) : (
                <p className="px-2 py-1.5 text-placeholder">Loading…</p>
              )}
            </Combobox.List>
            {footerOption}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
