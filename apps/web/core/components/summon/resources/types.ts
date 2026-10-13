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

export type TResourceKind =
  | "document"
  | "repository"
  | "figma"
  | "deployment"
  | "drive"
  | "recording"
  | "account"
  | "pdf"
  | "spreadsheet"
  | "presentation";

/**
 * Label hue per resource kind. `tile` tints an icon tile; `badge` tints a text chip.
 * Class names stay literal so Tailwind can find them.
 */
export const RESOURCE_KIND_TONE: Record<TResourceKind, { tile: string; badge: string }> = {
  document: { tile: "bg-label-indigo-bg text-label-indigo-icon", badge: "bg-label-indigo-bg text-label-indigo-text" },
  repository: { tile: "bg-label-grey-bg text-label-grey-icon", badge: "bg-label-grey-bg text-label-grey-text" },
  figma: { tile: "bg-label-pink-bg text-label-pink-icon", badge: "bg-label-pink-bg text-label-pink-text" },
  deployment: {
    tile: "bg-label-emerald-bg text-label-emerald-icon",
    badge: "bg-label-emerald-bg text-label-emerald-text",
  },
  drive: { tile: "bg-label-yellow-bg text-label-yellow-icon", badge: "bg-label-yellow-bg text-label-yellow-text" },
  recording: { tile: "bg-label-purple-bg text-label-purple-icon", badge: "bg-label-purple-bg text-label-purple-text" },
  account: { tile: "bg-label-orange-bg text-label-orange-icon", badge: "bg-label-orange-bg text-label-orange-text" },
  pdf: { tile: "bg-label-crimson-bg text-label-crimson-icon", badge: "bg-label-crimson-bg text-label-crimson-text" },
  spreadsheet: {
    tile: "bg-label-emerald-bg text-label-emerald-icon",
    badge: "bg-label-emerald-bg text-label-emerald-text",
  },
  presentation: {
    tile: "bg-label-orange-bg text-label-orange-icon",
    badge: "bg-label-orange-bg text-label-orange-text",
  },
};
