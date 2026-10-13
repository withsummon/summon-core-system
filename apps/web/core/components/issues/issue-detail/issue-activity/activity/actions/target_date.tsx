/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// components
import { IssueDateActivity } from "./helpers/date-activity";

type TIssueTargetDateActivity = { activityId: string; showIssue?: boolean; ends: "top" | "bottom" | undefined };

export function IssueTargetDateActivity(props: TIssueTargetDateActivity) {
  return <IssueDateActivity {...props} dateLabel="due date" />;
}
