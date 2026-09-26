/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ComboboxPrimitive as Combobox } from "@plane/propel/combobox";
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
            "flex w-full items-center justify-between gap-1 rounded text-11 outline-none focus-visible:ring-2 focus-visible:ring-accent-strong/40 disabled:cursor-not-allowed disabled:opacity-50",
            render || customButton
              ? customButtonClassName
              : ["border border-strong", input ? "px-3 py-2 text-13" : "px-2 py-1", buttonClassName]
          )}
        >
          {render ? undefined : (customButton ?? label)}
          {!render && !customButton && !noChevron && <ChevronDownIcon className={cn("size-3", chevronClassName)} />}
        </Combobox.Trigger>
      </div>
      <Combobox.Portal>
        <Combobox.Positioner side={side} align={align} sideOffset={4} className="z-[120]">
          <Combobox.Popup
            className={cn(
              "min-w-48 rounded-md border border-subtle-1 bg-surface-1 p-2 text-11 shadow-raised-200 outline-none",
              optionsClassName
            )}
          >
            <div className="flex items-center gap-1.5 rounded border border-subtle px-2">
              <SearchIcon className="size-3.5 text-placeholder" />
              <Combobox.Input
                aria-label="Search options"
                placeholder="Search"
                className="w-full bg-transparent py-1 text-11 outline-none"
              />
            </div>
            <Combobox.List
              className={cn("mt-2 space-y-1 overflow-y-auto", {
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
                      className="flex w-full cursor-default items-center justify-between gap-2 rounded px-1 py-1.5 outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-layer-transparent-hover"
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
                  <p className="px-1.5 py-1 text-placeholder">{noResultsMessage}</p>
                )
              ) : (
                <p className="px-1.5 py-1 text-placeholder">Loading…</p>
              )}
            </Combobox.List>
            {footerOption}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
