/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { EllipsisVertical } from "lucide-react";
import { Popover as Primitive } from "@plane/propel/popover";
import { cn } from "../utils";
import type { TPopover } from "./types";

export function Popover({
  popperPosition = "bottom-end",
  popperPadding = 0,
  buttonClassName,
  popoverClassName,
  button,
  disabled = false,
  panelClassName,
  children,
  popoverButtonRef,
  buttonRefClassName,
}: TPopover) {
  return (
    <Primitive>
      <div className={cn("relative flex h-full w-full items-center justify-center", popoverClassName)}>
        <div className={cn("w-full", buttonRefClassName)}>
          <Primitive.Button
            ref={popoverButtonRef}
            disabled={disabled}
            aria-label={button ? undefined : "More options"}
            className={cn(
              !button &&
                "flex size-6 items-center justify-center rounded-sm bg-surface-2 text-14 transition-colors hover:bg-layer-1",
              buttonClassName
            )}
          >
            {button ?? <EllipsisVertical className="size-3" />}
          </Primitive.Button>
        </div>
      </div>
      <Primitive.Panel
        placement={popperPosition}
        collisionPadding={popperPadding}
        positionerClassName="z-30"
        className={cn("w-screen max-w-xs", panelClassName)}
      >
        {children}
      </Primitive.Panel>
    </Primitive>
  );
}
