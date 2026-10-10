/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { cn } from "../utils/classname";

export type TSelectableIcon = PhosphorIcon;

/*
 * Outline while idle, filled once the nearest `group/select` ancestor is selected.
 * Selection is read from the attribute each owner already emits: Base UI tabs and nav
 * items (`data-active`), links (`aria-current="page"`) and
 * toggles (`aria-pressed`). Callers never pass the active state. The cross-fade lives
 * in the shared `.selectable-icon` CSS so it stays interruptible.
 */
export function SelectableIcon({ icon: Icon, className }: { icon: TSelectableIcon; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("selectable-icon size-4", className)}>
      <Icon weight="regular" className="selectable-icon-outline" />
      <Icon weight="fill" className="selectable-icon-fill" />
    </span>
  );
}
