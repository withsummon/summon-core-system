/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ComboboxPrimitive as Combobox } from "@plane/propel/combobox";
import React from "react";
// helper
import { cn } from "../../utils";
import type { IMultiSelectDropdownButton, ISingleSelectDropdownButton } from "../dropdown";

export function DropdownButton(props: IMultiSelectDropdownButton | ISingleSelectDropdownButton) {
  const { isOpen, buttonContent, buttonClassName, buttonContainerClassName, tabIndex, value, disabled } = props;
  return (
    <Combobox.Trigger
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
      {buttonContent ? <>{buttonContent(isOpen, value)}</> : <span className={cn("", buttonClassName)}>{value}</span>}
    </Combobox.Trigger>
  );
}
