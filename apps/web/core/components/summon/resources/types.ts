/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ISummonResourceLink, TSummonResourceType } from "@plane/types";

export type TResourceViewMode = "list" | "grid";

export type TResourceSortOption = "recently_updated" | "name_asc" | "name_desc" | "project";

export interface IResourceCategoryCount {
  category: TSummonResourceType;
  label: string;
  count: number;
  iconType: "document" | "repository" | "figma" | "deployment" | "drive" | "recording" | "account";
  bgColor: string;
  textColor: string;
}

export interface IResourceFilterState {
  searchQuery: string;
  selectedCategory: string;
  selectedProject: string;
  sortBy: TResourceSortOption;
}

export interface ICreateResourcePayload extends Record<string, unknown> {
  title: string;
  url: string;
  category: string;
  description?: string;
  project?: string;
  page?: string;
  client?: string;
  credential?: string;
}
