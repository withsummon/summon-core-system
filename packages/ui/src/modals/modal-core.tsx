/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { Dialog } from "@plane/propel/dialog";
import { cn } from "../utils";
import { EModalPosition, EModalWidth } from "./constants";

type Props = {
  children: React.ReactNode;
  handleClose: () => void;
  isOpen: boolean;
  position?: EModalPosition;
  width?: EModalWidth;
  className?: string;
  initialFocus?: React.ComponentProps<typeof Dialog.Panel>["initialFocus"];
};
export function ModalCore({
  children,
  handleClose,
  isOpen,
  position = EModalPosition.CENTER,
  width = EModalWidth.XXL,
  className,
  initialFocus,
}: Props) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <Dialog.Panel
        initialFocus={initialFocus}
        position={position === EModalPosition.TOP ? "top" : "center"}
        className={cn(width, className)}
      >
        {children}
      </Dialog.Panel>
    </Dialog>
  );
}
