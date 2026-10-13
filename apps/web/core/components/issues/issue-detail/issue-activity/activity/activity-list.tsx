/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { observer } from "mobx-react";
// helpers
import { getValidKeysFromObject } from "@plane/utils";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useTimeLineRelationOptions } from "@/components/relations";
// local components
import {
  IssueDefaultActivity,
  IssueNameActivity,
  IssueDescriptionActivity,
  IssueStateActivity,
  IssueAssigneeActivity,
  IssuePriorityActivity,
  IssueEstimateActivity,
  IssueParentActivity,
  IssueRelationActivity,
  IssueStartDateActivity,
  IssueTargetDateActivity,
  IssueCycleActivity,
  IssueModuleActivity,
  IssueLabelActivity,
  IssueLinkActivity,
  IssueAttachmentActivity,
  IssueArchivedAtActivity,
  IssueInboxActivity,
} from "./actions";

type TIssueActivityItem = {
  activityId: string;
  ends: "top" | "bottom" | undefined;
};

type TActivityRenderer = (props: TIssueActivityItem) => ReactNode;

// field -> activity block; fields not listed here fall back to relations, then render nothing
const ACTIVITY_RENDERERS: Record<string, TActivityRenderer> = {
  state: (props) => <IssueStateActivity {...props} showIssue={false} />,
  name: (props) => <IssueNameActivity {...props} />,
  description: (props) => <IssueDescriptionActivity {...props} showIssue={false} />,
  assignees: (props) => <IssueAssigneeActivity {...props} showIssue={false} />,
  priority: (props) => <IssuePriorityActivity {...props} showIssue={false} />,
  estimate_points: (props) => <IssueEstimateActivity {...props} showIssue={false} />,
  estimate_categories: (props) => <IssueEstimateActivity {...props} showIssue={false} />,
  // older recorded estimate activities; the field changed from "estimate_point" to `estimate_${estimate_type}`
  estimate_point: (props) => <IssueEstimateActivity {...props} showIssue={false} />,
  parent: (props) => <IssueParentActivity {...props} showIssue={false} />,
  start_date: (props) => <IssueStartDateActivity {...props} showIssue={false} />,
  target_date: (props) => <IssueTargetDateActivity {...props} showIssue={false} />,
  cycles: (props) => <IssueCycleActivity {...props} />,
  modules: (props) => <IssueModuleActivity {...props} />,
  labels: (props) => <IssueLabelActivity {...props} showIssue={false} />,
  link: (props) => <IssueLinkActivity {...props} showIssue={false} />,
  attachment: (props) => <IssueAttachmentActivity {...props} showIssue={false} />,
  archived_at: (props) => <IssueArchivedAtActivity {...props} />,
  intake: (props) => <IssueInboxActivity {...props} />,
  inbox: (props) => <IssueInboxActivity {...props} />,
};

export const IssueActivityItem = observer(function IssueActivityItem(props: TIssueActivityItem) {
  const { activityId, ends } = props;
  // hooks
  const {
    activity: { getActivityById },
  } = useIssueDetail();
  const ISSUE_RELATION_OPTIONS = useTimeLineRelationOptions();
  const activityRelations = getValidKeysFromObject(ISSUE_RELATION_OPTIONS);

  const componentDefaultProps = { activityId, ends };

  const activityField = getActivityById(activityId)?.field;
  // default issue creation
  if (activityField === null) return <IssueDefaultActivity {...componentDefaultProps} />;

  const renderActivity = activityField === undefined ? undefined : ACTIVITY_RENDERERS[activityField];
  if (renderActivity) return renderActivity(componentDefaultProps);

  // a missing activity also lands here, as it did when relations were matched with `find`
  if (activityField === undefined || activityRelations.includes(activityField))
    return <IssueRelationActivity {...componentDefaultProps} />;

  return null;
});
