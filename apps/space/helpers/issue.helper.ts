/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { differenceInCalendarDays } from "date-fns/differenceInCalendarDays";
// plane internal
import { STATE_GROUPS } from "@plane/constants";
import type { TStateGroups } from "@plane/types";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";

export const stateGroups = {
  backlog: "backlog",
  todo: "unstarted",
  in_progress: "started",
  done: "completed",
  cancelled: "cancelled",
} satisfies Record<
  FunctionReturnType<typeof api.publicSharing.index.catalog>["states"][number]["status"],
  keyof typeof STATE_GROUPS
>;
// helpers
import { getDate } from "@/helpers/date-time.helper";

/**
 * @description check if the issue due date should be highlighted
 * @param date
 * @param stateGroup
 * @returns boolean
 */
export const shouldHighlightIssueDueDate = (
  date: string | Date | null,
  stateGroup: TStateGroups | undefined
): boolean => {
  if (!date || !stateGroup) return false;
  // if the issue is completed or cancelled, don't highlight the due date
  if ([STATE_GROUPS.completed.key, STATE_GROUPS.cancelled.key].includes(stateGroup)) return false;

  const parsedDate = getDate(date);
  if (!parsedDate) return false;

  const targetDateDistance = differenceInCalendarDays(parsedDate, new Date());

  // if the issue is overdue, highlight the due date
  return targetDateDistance <= 0;
};
