/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// types
import type { TIssuesListTypes } from "@plane/types";

export enum EDurationFilters {
  NONE = "none",
  TODAY = "today",
  THIS_WEEK = "this_week",
  THIS_MONTH = "this_month",
  THIS_YEAR = "this_year",
  CUSTOM = "custom",
}

// filter duration options
export const DURATION_FILTER_OPTIONS: {
  key: EDurationFilters;
  label: string;
}[] = [
  {
    key: EDurationFilters.NONE,
    label: "All time",
  },
  {
    key: EDurationFilters.TODAY,
    label: "Due today",
  },
  {
    key: EDurationFilters.THIS_WEEK,
    label: "Due this week",
  },
  {
    key: EDurationFilters.THIS_MONTH,
    label: "Due this month",
  },
  {
    key: EDurationFilters.THIS_YEAR,
    label: "Due this year",
  },
  {
    key: EDurationFilters.CUSTOM,
    label: "Custom",
  },
];

// random background colors for project cards
export const PROJECT_BACKGROUND_COLORS = [
  "bg-label-grey-bg",
  "bg-success-subtle",
  "bg-danger-subtle",
  "bg-label-orange-bg",
  "bg-label-indigo-bg",
  "bg-label-yellow-bg",
  "bg-label-pink-bg",
  "bg-label-purple-bg",
];

// assigned and created issues widgets tabs list
export const FILTERED_ISSUES_TABS_LIST: {
  key: TIssuesListTypes;
  label: string;
}[] = [
  {
    key: "upcoming",
    label: "Upcoming",
  },
  {
    key: "overdue",
    label: "Overdue",
  },
  {
    key: "completed",
    label: "Marked completed",
  },
];

// assigned and created issues widgets tabs list
export const UNFILTERED_ISSUES_TABS_LIST: {
  key: TIssuesListTypes;
  label: string;
}[] = [
  {
    key: "pending",
    label: "Pending",
  },
  {
    key: "completed",
    label: "Marked completed",
  },
];

export type TLinkOptions = {
  userId: string | undefined;
};
