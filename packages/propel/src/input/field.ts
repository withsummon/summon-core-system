/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/**
 * The one look every field-like control shares: input, textarea, select, date picker, combobox trigger.
 * Height is left to the control; single-line triggers add `h-9`.
 */
export const FIELD_CLASSNAME =
  "rounded-lg border border-subtle bg-layer-2 text-13 text-primary shadow-raised-100 outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-placeholder focus-visible:border-accent-strong focus-visible:ring-[3px] focus-visible:ring-accent-subtle motion-reduce:transition-none";
