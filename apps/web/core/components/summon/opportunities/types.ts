/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TPipelineStage =
  | "All"
  | "Lead"
  | "Qualified"
  | "POC / Discovery"
  | "Proposal"
  | "Negotiation"
  | "Closed Won"
  | "Closed Lost";

export interface IOpportunityItem {
  id: string;
  title: string;
  client: string;
  initials: string;
  avatarColor: "blue" | "purple" | "green" | "orange" | "cyan" | "pink";
  stage: TPipelineStage;
  stageBadgeText: string;
  updatedAt: string;
  value: string;
  probability: number;
  expectedClose: string;
  owner: {
    name: string;
    avatar?: string;
    role?: string;
  };
  isFavorite?: boolean;
  about: {
    description: string;
    solution: string;
    product: string;
    picClient: string;
    department: string;
    createdDate: string;
    source: string;
  };
  stageProgress: {
    stage: string;
    date?: string;
    status: "completed" | "current" | "upcoming";
  }[];
  nextSteps: {
    id: string;
    title: string;
    dueDate: string;
    dueBadgeType: "today" | "upcoming" | "future";
    assignee: {
      name: string;
      avatar: string;
    };
    completed?: boolean;
  }[];
  keyContacts: {
    id: string;
    name: string;
    role: string;
    avatar: string;
    email: string;
    phone?: string;
  }[];
  relatedAssets: {
    id: string;
    title: string;
    type: "Document" | "Video" | "Sheet" | "Presentation";
    iconType: "doc" | "video" | "checklist" | "proposal";
  }[];
  recentActivity: {
    id: string;
    title: string;
    author: string;
    timeAgo: string;
    color: "blue" | "purple" | "green";
  }[];
}

export interface IPipelineStageCount {
  stage: TPipelineStage;
  count: number;
  color: string;
}
