/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { TabsContent, TabsIndicator, TabsList, TabsRoot, TabsTrigger } from "./tabs";
import type { TabsCompound } from "./tabs";

export const Tabs = Object.assign(TabsRoot, {
  List: TabsList,
  Trigger: TabsTrigger,
  Content: TabsContent,
  Indicator: TabsIndicator,
}) satisfies TabsCompound;
