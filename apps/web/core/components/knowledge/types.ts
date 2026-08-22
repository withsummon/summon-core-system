/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TKnowledgeCategory = "All" | "Notes" | "Documents" | "Guides" | "FAQs" | "Lessons Learned";

export type TKnowledgeItemType = "Document" | "Note" | "Template" | "Lesson Learned" | "Guide" | "FAQ";

export type TContextCategory = "Projects" | "Clients" | "Opportunities" | "Processes" | "Company";

export interface IKnowledgeContextCard {
  id: string;
  name: TContextCategory;
  title: string;
  count: number;
  description: string;
  iconType: "projects" | "clients" | "opportunities" | "processes" | "company";
}

export interface IKnowledgeItem {
  id: string;
  title: string;
  description: string;
  context: string;
  type: TKnowledgeItemType;
  updatedAt: string;
  updatedBy: {
    name: string;
    avatar?: string;
    initials: string;
  };
  views?: number;
  content?: string;
  tags?: string[];
}

export interface IRecentNote {
  id: string;
  title: string;
  timeAgo: string;
  iconColor: "yellow" | "green" | "blue" | "gray" | "orange";
}

export interface IPopularKnowledgeItem {
  id: string;
  title: string;
  views: number;
  fireColor: "red" | "orange" | "green" | "blue";
}

export interface IKnowledgeStats {
  totalArticles: number;
  totalViews: string;
  contributors: number;
  thisMonthCount: number;
  thisMonthGrowthPercentage: number;
}
