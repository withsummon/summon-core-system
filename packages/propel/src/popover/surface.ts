/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/**
 * The one look and motion every floating list shares: menus, selects, comboboxes, context menus.
 * Base UI sets `data-starting-style` / `data-ending-style` while a popup mounts and unmounts, so the
 * popup grows from its trigger (`--transform-origin`) on open and fades out on close.
 */
export const POPUP_MOTION_CLASSNAME =
  "origin-[var(--transform-origin)] transition-[opacity,scale] duration-150 ease-out data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 motion-reduce:transition-none";

export const POPUP_CLASSNAME = `rounded-xl border border-subtle bg-surface-1 p-1 text-13 text-primary shadow-overlay-100 outline-none ${POPUP_MOTION_CLASSNAME}`;

/** One row in a popup list. Base UI marks rows with `data-highlighted`, `data-selected` and `data-disabled`. */
export const POPUP_OPTION_CLASSNAME =
  "flex w-full min-w-0 cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-left text-13 text-secondary outline-none select-none data-[highlighted]:bg-layer-1 data-[highlighted]:text-primary data-[selected]:text-primary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50";

/** The search field pinned to the top of a searchable popup; the input inside it uses `POPUP_SEARCH_INPUT_CLASSNAME`. */
export const POPUP_SEARCH_CLASSNAME =
  "mb-1 flex h-8 items-center gap-2 rounded-lg border border-subtle bg-layer-2 px-2 text-placeholder transition-[border-color] duration-150 focus-within:border-accent-strong";

export const POPUP_SEARCH_INPUT_CLASSNAME =
  "h-full w-full min-w-0 bg-transparent text-13 text-primary outline-none placeholder:text-placeholder";
