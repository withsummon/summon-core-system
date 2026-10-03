/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
export type TResourceViewMode = "list" | "grid";
export type TResourceSortOption = "recently_updated" | "name_asc" | "name_desc" | "project";
export type ICreateResourcePayload = Omit<FunctionArgs<typeof api.resources.index.create>, "workspaceId">;
