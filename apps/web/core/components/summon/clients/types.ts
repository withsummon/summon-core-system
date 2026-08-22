/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TClientTab =
  | "Overview"
  | "Opportunities"
  | "Projects"
  | "Contacts"
  | "Documents"
  | "Activity"
  | "Notes"
  | "Settings";

export interface IClientContact {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  isPrimary?: boolean;
}

export interface IClientOpportunity {
  id: string;
  title: string;
  category: string;
  stage: string;
  owner: {
    name: string;
    avatar?: string;
  };
  valueIdr: string;
  closeDate: string;
  progress: number;
}

export interface IClientProject {
  id: string;
  name: string;
  type: string;
  status: "Completed" | "In Progress" | "Planning" | "On Hold";
  owner: {
    name: string;
    avatar?: string;
  };
  startDate: string;
  endDate: string;
}

export interface IClientActivity {
  id: string;
  title: string;
  timestamp: string;
  author: string;
  type: "meeting" | "document" | "upload" | "proposal" | "event";
}

export interface IClientNote {
  id: string;
  title: string;
  date: string;
  author: string;
}

export interface IRelationshipHealth {
  status: "Good" | "Excellent" | "At Risk" | "Critical";
  summary: string;
  communication: string;
  projectsOnTrack: string;
  satisfaction: string;
}

export interface IClientDetail {
  id: string;
  name: string;
  legalName: string;
  status: "Active Client" | "Prospect" | "Inactive";
  since: string;
  industry: string;
  website: string;
  headOffice: string;
  accountManager: {
    name: string;
    avatar?: string;
  };
  description: string;
  kpis: {
    activeOpportunities: number;
    activeProjects: number;
    totalProjects: number;
    lastInteraction: string;
    lastInteractionDetail: string;
  };
  opportunities: IClientOpportunity[];
  projects: IClientProject[];
  contacts: IClientContact[];
  activities: IClientActivity[];
  relationshipHealth: IRelationshipHealth;
  notes: IClientNote[];
}
