/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TSummonOpportunityStage = "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
export type TSummonAutomationJobStatus = "queued" | "running" | "completed" | "failed";
export type TSummonResourceType = "repository" | "figma" | "deployment" | "drive" | "recording" | "account" | string;
export type TSummonCredentialAccessAction =
  | "create"
  | "reveal"
  | "reveal_denied"
  | "rotate"
  | "rotate_denied"
  | "grant"
  | "revoke"
  | "delete";

export interface ISummonClient {
  id: string;
  name: string;
  description: string;
  status: string;
  industry: string;
  website: string;
  owner: string | null;
  created_at: string;
  updated_at: string;
}

export interface ISummonClientContact {
  id: string;
  client: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface ISummonOpportunity {
  id: string;
  client: string | null;
  owner: string | null;
  title: string;
  description: string;
  stage: TSummonOpportunityStage;
  probability: number;
  value: string | null;
  expected_close_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ISummonProjectProfile {
  id: string;
  project: string;
  client: string | null;
  source_opportunity: string | null;
  delivery_status: string;
  budget: string | null;
}

export interface ISummonIssueSnapshot {
  id: string;
  name: string;
  sequence_id: number;
  project: { id: string; identifier: string; name: string };
  state: { id: string; name: string; group: string } | null;
  completed: boolean;
}

export interface ISummonMeetingWorkItem {
  id: string;
  issue: ISummonIssueSnapshot;
  created_at: string;
}

export interface ISummonMeeting {
  id: string;
  title: string;
  agenda: string;
  notes: string;
  location: string;
  meeting_url: string;
  status: "scheduled" | "completed" | "cancelled";
  starts_at: string;
  ends_at: string | null;
  project: string | null;
  project_detail: { id: string; identifier: string; name: string } | null;
  recording_asset: string | null;
  recording_asset_detail: { id: string; name: string } | null;
  transcript_asset: string | null;
  transcript_asset_detail: { id: string; name: string } | null;
  summary_page: string | null;
  summary_page_detail: { id: string; name: string } | null;
  participants: Array<{ id: string; member: { id: string; display_name: string }; response: string }>;
  work_items: ISummonMeetingWorkItem[];
}

export interface ISummonResourceLink {
  id: string;
  project: string | null;
  page: string | null;
  client: string | null;
  credential: string | null;
  title: string;
  url: string;
  description: string;
  category: TSummonResourceType;
  created_at: string;
  updated_at: string;
}

export interface ISummonPageContext {
  id: string;
  page: string;
  page_detail: { id: string; name: string };
  project: string | null;
  client: string | null;
  opportunity: string | null;
  category: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ISummonAutomationTemplate {
  id: string;
  name: string;
  type: string;
  description: string;
  content_template: string;
  variables: string[];
  is_active: boolean;
}

export interface ISummonGeneratedArtifact {
  id: string;
  title: string;
  kind: string;
  page: string | null;
  file_asset: string | null;
  page_detail: { id: string; name: string; markdown: string } | null;
}

export interface ISummonAutomationJob {
  id: string;
  template: string | null;
  project: string | null;
  type: string;
  status: TSummonAutomationJobStatus;
  input: Record<string, unknown>;
  error_summary: string;
  artifacts: ISummonGeneratedArtifact[];
  created_at: string;
}

export interface ISummonReportSummary {
  projects: number;
  issues: { total: number; completed: number; overdue: number };
  commercial: { clients: number; opportunities: number; pipeline_value: string };
  knowledge: { pages: number; files: number };
  meetings: number;
  automation: { jobs: number; completed: number };
}

export interface ISummonAssistantResponse {
  intent: string;
  answer: string;
  data: unknown;
}

export interface ISummonCredential {
  id: string;
  project: string | null;
  owner: string | null;
  name: string;
  provider: string;
  account_identifier: string;
  secret: "••••••••";
  metadata: Record<string, unknown>;
  status: "active" | "revoked";
  created_at: string;
  updated_at: string;
}

export interface ISummonCredentialGrant {
  id: string;
  member: string;
  permission: "view" | "use" | "manage";
  expires_at: string | null;
  granted_by: string | null;
  created_at: string;
}

export interface ISummonCredentialAudit {
  id: string;
  member: string | null;
  action: TSummonCredentialAccessAction;
  reason: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string;
  created_at: string;
}
