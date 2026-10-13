/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { Fragment } from "react";
// components
import { POPUP_CLASSNAME } from "@plane/propel/popover";
import { cn } from "../utils";
import { Popover } from "./popover";
// helpers
// types
import type { TPopoverMenu } from "./types";

export function PopoverMenu<T>(props: TPopoverMenu<T>) {
  const {
    popperPosition = "bottom-end",
    popperPadding = 0,
    buttonClassName = "",
    button,
    disabled,
    panelClassName = "",
    data,
    popoverClassName = "",
    keyExtractor,
    render,
    popoverButtonRef,
  } = props;

  return (
    <Popover
      popperPosition={popperPosition}
      popperPadding={popperPadding}
      buttonClassName={buttonClassName}
      button={button}
      disabled={disabled}
      panelClassName={cn(POPUP_CLASSNAME, "w-48", panelClassName)}
      popoverClassName={popoverClassName}
      popoverButtonRef={popoverButtonRef}
    >
      <Fragment>
        {data.map((item, index) => (
          // oxlint-disable-next-line react/no-array-index-key -- callers own the key through keyExtractor
          <Fragment key={keyExtractor(item, index)}>{render(item, index)}</Fragment>
        ))}
      </Fragment>
    </Popover>
  );
}
