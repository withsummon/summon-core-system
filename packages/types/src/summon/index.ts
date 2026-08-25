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
  | "use"
  | "delete";

export interface ISummonAIStatus {
  configured: boolean;
  provider: "openai" | "openai_compatible" | "anthropic" | "codex" | "gemini" | null;
  model: string | null;
}

export interface ISummonClient {
  id: string;
  name: string;
  company_name: string;
  industry: string;
  email: string;
  phone: string;
  website: string;
  head_office: string;
  relationship_started_at: string | null;
  notes: string;
  status: "lead" | "active" | "inactive";
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
  title: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface ISummonOpportunity {
  id: string;
  client: string | null;
  owner: string | null;
  title: string;
  product: string;
  source: string;
  description: string;
  stage: TSummonOpportunityStage;
  probability: number;
  value: string | null;
  expected_close_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ISummonClientDetail extends ISummonClient {
  contacts: ISummonClientContact[];
  opportunities: ISummonOpportunity[];
  projects: Array<{ id: string; identifier: string; name: string }>;
  meetings: ISummonMeeting[];
  page_contexts: ISummonPageContext[];
  recent_activity: Array<{ id: string; label: string; created_at: string; href: string }>;
}

export interface ISummonOpportunityDetail extends ISummonOpportunity {
  client_detail: ISummonClient | null;
  contacts: ISummonClientContact[];
  project_profile: ISummonProjectProfile | null;
  meetings: ISummonMeeting[];
  page_contexts: ISummonPageContext[];
  work_items: ISummonMeetingWorkItem[];
  recent_activity: Array<{ id: string; label: string; created_at: string; href: string }>;
}

export interface ISummonProjectProfile {
  id: string;
  project: string;
  client: string | null;
  source_opportunity: string | null;
  delivery_status: string;
  phase: string;
  health: string;
  start_date: string | null;
  target_date: string | null;
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

export interface ISummonProjectFile {
  id: string;
  name: string;
  content_type: string;
  size: number;
  entity_type: string;
  url: string;
  created_at: string;
}

export interface ISummonHomeSummary {
  priority: ISummonIssueSnapshot[];
  projects: Array<{ id: string; identifier: string; name: string; health: string; completion: number }>;
  counts: { projects: number; issues: number; clients: number; opportunities: number };
  recent_activity: Array<{ id: string; label: string; created_at: string; href: string }>;
  upcoming_meetings: ISummonMeeting[];
  resources: ISummonResourceLink[];
}

export interface ISummonProjectOverview {
  project: { id: string; identifier: string; name: string; description: string };
  profile: ISummonProjectProfile | null;
  progress: { total: number; completed: number; overdue: number; percentage: number };
  milestones: Array<{ id: string; name: string; target_date: string | null; completion: number; href: string }>;
  issues: ISummonIssueSnapshot[];
  pages: Array<{ id: string; name: string; href: string }>;
  meetings: ISummonMeeting[];
  resources: ISummonResourceLink[];
  activity: Array<{ id: string; label: string; created_at: string; href: string }>;
  files: ISummonProjectFile[];
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
  organizer: string | null;
  project: string | null;
  project_detail: { id: string; identifier: string; name: string } | null;
  recording_asset: string | null;
  recording_asset_detail: { id: string; name: string; url: string | null } | null;
  transcript_asset: string | null;
  transcript_asset_detail: { id: string; name: string; url: string | null } | null;
  transcript_text: string;
  summary_page: string | null;
  summary_page_detail: {
    id: string;
    name: string;
    markdown: string;
    summary: string;
    decisions: string[];
    action_suggestions: Array<{ title: string; details: string }>;
    discussion_topics: Array<{ topic: string; details: string[] }>;
    todos_by_party: Array<{ party: string; items: Array<{ task: string; notes: string }> }>;
    open_items: string[];
    next_actions: Array<{ action: string; owner: string; due_date: string }>;
    citations: ISummonAssistantCitation[];
    context_truncated: boolean;
    href: string;
  } | null;
  summary_error:
    | ""
    | "transcribing"
    | "transcription_failed"
    | "transcript_required"
    | "project_required"
    | "project_access_revoked"
    | TSummonLLMErrorCode;
  summary_provider: string;
  summary_model: string;
  summary_input_tokens: number | null;
  summary_output_tokens: number | null;
  participants: Array<{ id: string; member: { id: string; display_name: string }; response: string }>;
  work_items: ISummonMeetingWorkItem[];
  created_at: string;
  updated_at: string;
}

export interface ISummonMeetingSummaryRequest {
  transcript_source?: "text" | "asset";
  context: ISummonAssistantMessageRequest["context"];
}

export interface ISummonResourceLink {
  id: string;
  project: string | null;
  project_detail?: { id: string; name: string; identifier: string } | null;
  page: string | null;
  client: string | null;
  credential: string | null;
  title: string;
  url: string;
  description: string;
  category: TSummonResourceType;
  created_by?: string | null;
  created_by_detail?: { id: string; display_name: string; avatar_url?: string } | null;
  updated_by?: string | null;
  updated_by_detail?: { id: string; display_name: string; avatar_url?: string } | null;
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
  format: "page" | "pdf" | "docx" | "xlsx" | "pptx";
  page: string | null;
  file_asset: string | null;
  page_detail: { id: string; name: string; markdown: string; href: string } | null;
  file_detail: { name: string; content_type: string; size: number; href: string } | null;
}

export interface ISummonAutomationJob {
  id: string;
  template: string | null;
  project: string | null;
  type: string;
  status: TSummonAutomationJobStatus;
  input: Record<string, unknown>;
  preview_markdown: string;
  provider: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  error_summary: string;
  published_at: string | null;
  citations: ISummonAssistantCitation[];
  context_truncated: boolean;
  artifacts: ISummonGeneratedArtifact[];
  created_at: string;
}

export interface ISummonAutomationPreviewRequest {
  template: string;
  project: string | null;
  input: Record<string, unknown>;
  context: ISummonAssistantMessageRequest["context"];
}

export interface ISummonReportFilters {
  projectId?: string;
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ISummonReportSummary {
  projects: number;
  issues: { total: number; completed: number; overdue: number };
  commercial: { clients: number; opportunities: number; pipeline_value: string };
  project_health: Array<{ project_id: string; name: string; health: string; completion: number }>;
  opportunity_stages: Array<{ stage: TSummonOpportunityStage; count: number; value: string }>;
  due_date_buckets: Array<{ label: string; count: number }>;
  completion_trend: Array<{ date: string; completed: number }>;
  knowledge: { pages: number; files: number };
  meetings: number;
  meeting_statuses: Array<{ status: ISummonMeeting["status"]; count: number }>;
  meeting_trend: Array<{ date: string; count: number }>;
  automation: { jobs: number; completed: number; failed: number };
  automation_statuses: Array<{ status: TSummonAutomationJobStatus; count: number }>;
  automation_usage: Array<{ date: string; count: number }>;
  recent_activity: Array<{ id: string; label: string; created_at: string; href: string }>;
}

export interface ISummonAssistantCitation {
  id: string;
  label: string;
  href: string;
  kind: "project" | "issue" | "page" | "client" | "meeting" | "resource" | "attachment";
}

export type TSummonAssistantAttachmentStatus = "processing" | "ready" | "failed";

export interface ISummonAssistantAttachment {
  id: string;
  message: string | null;
  original_name: string;
  media_type: string;
  size: number;
  status: TSummonAssistantAttachmentStatus;
  language: string;
  error: string;
  created_at: string;
}

export interface ISummonAssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: ISummonAssistantCitation[];
  provider: string;
  model: string;
  status: "completed" | "failed";
  attachments: ISummonAssistantAttachment[];
  automation_job: ISummonAutomationJob | null;
  created_at: string;
}

export interface ISummonAssistantConversation {
  id: string;
  title: string;
  project: string | null;
  client: string | null;
  mcp_credential: string | null;
  last_activity_at: string;
  messages?: ISummonAssistantMessage[];
  actions?: ISummonAssistantAction[];
  attachments?: ISummonAssistantAttachment[];
}

export interface ISummonAssistantDocumentTemplateChoice {
  id: string;
  name: string;
  type: string;
}

export interface ISummonAssistantActionPreview {
  title?: string;
  summary?: string;
  changes?: Record<string, unknown>;
  state?: "choose_template" | "confirm";
  template?: ISummonAssistantDocumentTemplateChoice | null;
  template_options?: ISummonAssistantDocumentTemplateChoice[];
  project?: { id: string; name: string } | null;
  sources?: Array<{ id: string; name: string; status: TSummonAssistantAttachmentStatus }>;
  formats?: Array<"pdf" | "docx">;
}

export interface ISummonAssistantAction {
  id: string;
  tool: string;
  arguments: Record<string, unknown>;
  preview: ISummonAssistantActionPreview;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "failed";
  confirmed_at: string | null;
  result: Record<string, unknown>;
  error: string;
  created_at: string;
}

export interface ISummonAssistantMessageRequest {
  content: string;
  context: {
    workspace?: boolean;
    project_id?: string;
    client_id?: string;
    meeting_id?: string;
    page_ids?: string[];
  };
  intent?: string;
  tool?: string;
  arguments?: Record<string, unknown>;
  attachment_ids?: string[];
}

export interface ISummonAssistantMessagePair {
  user_message: ISummonAssistantMessage;
  assistant_message: ISummonAssistantMessage;
  action?: ISummonAssistantAction | null;
  context_truncated: boolean;
}

export interface ISummonWorkspaceSettings {
  name: string;
  slug: string;
  logo: string | null;
  organization_size: string | null;
  timezone: string;
  industry: string;
  description: string;
  currency: string;
  workweek: Array<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun">;
}

export interface ISummonMCPStatus {
  reachable: boolean;
  endpoint: string;
  transport: "streamable-http";
  authentication: string;
}

export type TSummonLLMErrorCode =
  | "llm_not_configured"
  | "llm_authentication_failed"
  | "llm_rate_limited"
  | "llm_timeout"
  | "llm_provider_unavailable"
  | "llm_invalid_response"
  | "llm_context_too_large";

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
