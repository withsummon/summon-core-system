/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { POPUP_CLASSNAME, POPUP_OPTION_CLASSNAME } from "../popover/surface";
import { cn } from "../utils/classname";

/** Surface and item styles, exported for menus composed from `MenuPrimitive` parts (filter inputs, checkbox items). */
export const MENU_POPUP_CLASSNAME = cn("min-w-48 overflow-y-auto", POPUP_CLASSNAME);
export const MENU_ITEM_CLASSNAME = cn(POPUP_OPTION_CLASSNAME, "text-primary");
