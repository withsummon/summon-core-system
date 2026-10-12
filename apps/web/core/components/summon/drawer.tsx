/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { getButtonStyling } from "@plane/propel/button";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle } from "@plane/propel/drawer";

/** A modal drawer for forms and record details: right side from md up, a bottom sheet on a phone. */
export function SummonDrawer(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Let the body run edge to edge (tabs, tables); otherwise it gets the standard padding. */
  flush?: boolean;
}) {
  return (
    <Drawer side="auto" open={props.open} onOpenChange={props.onOpenChange}>
      <DrawerContent backdrop className="vertical-scrollbar overflow-y-auto">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-subtle bg-surface-1 px-5 py-4">
          <div className="min-w-0">
            <DrawerTitle className="text-16 font-semibold text-primary">{props.title}</DrawerTitle>
            {props.description ? (
              <DrawerDescription className="mt-0.5 text-13 text-tertiary">{props.description}</DrawerDescription>
            ) : null}
          </div>
          <DrawerClose aria-label="Close" className={`${getButtonStyling("ghost", "base")} size-8 flex-none px-0`}>
            <X />
          </DrawerClose>
        </header>
        <div className={props.flush ? undefined : "p-5"}>{props.children}</div>
      </DrawerContent>
    </Drawer>
  );
}
