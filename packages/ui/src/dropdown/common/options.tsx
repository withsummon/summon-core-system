/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ComboboxPrimitive as Combobox } from "@plane/propel/combobox";

import React from "react";
import { CheckIcon } from "@plane/propel/icons";
// helpers
import { cn } from "../../utils";
// types
import type { IMultiSelectDropdownOptions, ISingleSelectDropdownOptions } from "../dropdown";
// components
import { DropdownOptionsLoader, InputSearch } from ".";

export function DropdownOptions(props: IMultiSelectDropdownOptions | ISingleSelectDropdownOptions) {
  const {
    isOpen,
    query,
    setQuery,
    inputIcon,
    inputPlaceholder,
    inputClassName,
    inputContainerClassName,
    disableSearch,
    keyExtractor,
    options,
    renderItem,
    loader,
    isMobile = false,
  } = props;
  return (
    <>
      {!disableSearch && (
        <InputSearch
          isOpen={isOpen}
          query={query}
          updateQuery={setQuery}
          inputIcon={inputIcon}
          inputPlaceholder={inputPlaceholder}
          inputClassName={inputClassName}
          inputContainerClassName={inputContainerClassName}
          isMobile={isMobile}
        />
      )}
      <Combobox.List className={cn("max-h-48 space-y-1 overflow-y-scroll", !disableSearch && "mt-2")}>
        <>
          {options ? (
            options.length > 0 ? (
              options?.map((option) => (
                <Combobox.Item
                  key={keyExtractor(option)}
                  value={keyExtractor(option)}
                  disabled={option.disabled}
                  className={({ highlighted: active, selected }) =>
                    cn(
                      "flex w-full cursor-pointer items-center justify-between gap-2 truncate rounded-sm px-1 py-1.5 select-none",
                      {
                        "bg-layer-1": active,
                        "text-primary": selected,
                        "text-secondary": !selected,
                      },
                      option.className && option.className({ active, selected })
                    )
                  }
                >
                  <>
                    <span className="flex-grow truncate">
                      {renderItem
                        ? renderItem({
                            value: keyExtractor(option),
                            selected: Array.isArray(props.value)
                              ? props.value.includes(keyExtractor(option))
                              : props.value === keyExtractor(option),
                            disabled: option.disabled,
                          })
                        : option.value}
                    </span>
                    <Combobox.ItemIndicator>
                      <CheckIcon className="size-3.5" />
                    </Combobox.ItemIndicator>
                  </>
                </Combobox.Item>
              ))
            ) : (
              <p className="px-1.5 py-1 text-placeholder italic">No matching results</p>
            )
          ) : loader ? (
            <> {loader} </>
          ) : (
            <DropdownOptionsLoader />
          )}
        </>
      </Combobox.List>
    </>
  );
}
