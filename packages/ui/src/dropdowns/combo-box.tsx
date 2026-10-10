/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode, ReactElement, Ref } from "react";
import { forwardRef } from "react";
import type { TPlacement } from "@plane/propel/utils";
import { convertPlacementToSideAndAlign } from "@plane/propel/utils";
import { ComboboxPrimitive } from "@plane/propel/combobox";

type Props = {
  ref?: Ref<HTMLDivElement>;
  tabIndex?: number;
  className?: string;
  value?: string | string[] | null;
  onChange?: (value: any) => void;
  disabled?: boolean;
  multiple?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placement?: TPlacement;
  button: ReactElement;
  children: ReactNode;
};

/** Features own values and open state; Base UI owns anchoring, dismissal, focus, and list navigation. */
const ComboDropDown = forwardRef<HTMLDivElement, Props>(function ComboDropDown(
  { button, open, onOpenChange, placement = "bottom-start", children, value, onChange, disabled, multiple, ...rest },
  ref
) {
  const { side, align } = convertPlacementToSideAndAlign(placement);
  const popup = (
    <ComboboxPrimitive.Positioner side={side} align={align} sideOffset={4} className="z-[120]">
      <ComboboxPrimitive.Popup data-prevent-outside-click>{children}</ComboboxPrimitive.Popup>
    </ComboboxPrimitive.Positioner>
  );

  return (
    <div {...rest} ref={ref}>
      <ComboboxPrimitive.Root<string, boolean>
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        multiple={multiple}
        open={open}
        onOpenChange={onOpenChange}
        filter={null}
      >
        <ComboboxPrimitive.Trigger render={button} disabled={disabled} />
        <ComboboxPrimitive.Portal>{popup}</ComboboxPrimitive.Portal>
      </ComboboxPrimitive.Root>
    </div>
  );
});

export { ComboDropDown };
