/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type {
  ISummonAIStatus,
  ISummonAssistantAction,
  ISummonAssistantConversation,
  ISummonAssistantMessagePair,
  ISummonAssistantMessageRequest,
  ISummonAutomationJob,
  ISummonAutomationPreviewRequest,
  ISummonAutomationTemplate,
  ISummonClient,
  ISummonClientContact,
  ISummonClientDetail,
  ISummonCredential,
  ISummonCredentialAudit,
  ISummonCredentialGrant,
  ISummonMeeting,
  ISummonMeetingSummaryRequest,
  ISummonMeetingWorkItem,
  ISummonMCPStatus,
  ISummonHomeSummary,
  ISummonOpportunity,
  ISummonOpportunityDetail,
  ISummonPageContext,
  ISummonProjectProfile,
  ISummonProjectOverview,
  ISummonReportFilters,
  ISummonReportSummary,
  ISummonResourceLink,
  ISummonWorkspaceSettings,
  TIssue,
} from "@plane/types";
import { APIService } from "@/services/api.service";

type TPayload = Record<string, unknown>;

export class SummonService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  private root(workspaceSlug: string) {
    return `/api/summon/workspaces/${workspaceSlug}`;
  }

  private data<T>(request: Promise<{ data: T }>): Promise<T> {
    return request
      .then((response) => response.data)
      .catch((error) => {
        throw error?.response?.data ?? error;
      });
  }

  getHomeSummary(workspaceSlug: string) {
    return this.data<ISummonHomeSummary>(this.get(`${this.root(workspaceSlug)}/home/summary/`));
  }

  getAIStatus(workspaceSlug: string) {
    return this.data<ISummonAIStatus>(this.get(`${this.root(workspaceSlug)}/settings/ai-status/`));
  }

  getProjectOverview(workspaceSlug: string, projectId: string) {
    return this.data<ISummonProjectOverview>(this.get(`${this.root(workspaceSlug)}/projects/${projectId}/overview/`));
  }

  listClients(workspaceSlug: string) {
    return this.data<ISummonClient[]>(this.get(`${this.root(workspaceSlug)}/clients/`));
  }

  createClient(workspaceSlug: string, payload: TPayload) {
    return this.data<ISummonClient>(this.post(`${this.root(workspaceSlug)}/clients/`, payload));
  }

  getClient(workspaceSlug: string, clientId: string) {
    return this.data<ISummonClient>(this.get(`${this.root(workspaceSlug)}/clients/${clientId}/`));
  }

  getClientDetail(workspaceSlug: string, clientId: string) {
    return this.data<ISummonClientDetail>(this.get(`${this.root(workspaceSlug)}/clients/${clientId}/`));
  }

  updateClient(workspaceSlug: string, clientId: string, payload: TPayload) {
    return this.data<ISummonClient>(this.patch(`${this.root(workspaceSlug)}/clients/${clientId}/`, payload));
  }

  deleteClient(workspaceSlug: string, clientId: string) {
    return this.data<void>(this.delete(`${this.root(workspaceSlug)}/clients/${clientId}/`));
  }

  listClientContacts(workspaceSlug: string, clientId: string) {
    return this.data<ISummonClientContact[]>(this.get(`${this.root(workspaceSlug)}/clients/${clientId}/contacts/`));
  }

  createClientContact(workspaceSlug: string, clientId: string, payload: TPayload) {
    return this.data<ISummonClientContact>(
      this.post(`${this.root(workspaceSlug)}/clients/${clientId}/contacts/`, payload)
    );
  }

  getClientContact(workspaceSlug: string, clientId: string, contactId: string) {
    return this.data<ISummonClientContact>(
      this.get(`${this.root(workspaceSlug)}/clients/${clientId}/contacts/${contactId}/`)
    );
  }

  updateClientContact(workspaceSlug: string, clientId: string, contactId: string, payload: TPayload) {
    return this.data<ISummonClientContact>(
      this.patch(`${this.root(workspaceSlug)}/clients/${clientId}/contacts/${contactId}/`, payload)
    );
  }

  deleteClientContact(workspaceSlug: string, clientId: string, contactId: string) {
    return this.data<void>(this.delete(`${this.root(workspaceSlug)}/clients/${clientId}/contacts/${contactId}/`));
  }

  listOpportunities(workspaceSlug: string) {
    return this.data<ISummonOpportunity[]>(this.get(`${this.root(workspaceSlug)}/opportunities/`));
  }

  createOpportunity(workspaceSlug: string, payload: TPayload) {
    return this.data<ISummonOpportunity>(this.post(`${this.root(workspaceSlug)}/opportunities/`, payload));
  }

  getOpportunity(workspaceSlug: string, opportunityId: string) {
    return this.data<ISummonOpportunity>(this.get(`${this.root(workspaceSlug)}/opportunities/${opportunityId}/`));
  }

  getOpportunityDetail(workspaceSlug: string, opportunityId: string) {
    return this.data<ISummonOpportunityDetail>(this.get(`${this.root(workspaceSlug)}/opportunities/${opportunityId}/`));
  }

  updateOpportunity(workspaceSlug: string, opportunityId: string, payload: TPayload) {
    return this.data<ISummonOpportunity>(
      this.patch(`${this.root(workspaceSlug)}/opportunities/${opportunityId}/`, payload)
    );
  }

  deleteOpportunity(workspaceSlug: string, opportunityId: string) {
    return this.data<void>(this.delete(`${this.root(workspaceSlug)}/opportunities/${opportunityId}/`));
  }

  transitionOpportunity(workspaceSlug: string, opportunityId: string, payload: TPayload) {
    return this.data<ISummonOpportunity>(
      this.post(`${this.root(workspaceSlug)}/opportunities/${opportunityId}/transitions/`, payload)
    );
  }

  getProjectProfile(workspaceSlug: string, projectId: string) {
    return this.data<ISummonProjectProfile>(this.get(`${this.root(workspaceSlug)}/projects/${projectId}/profile/`));
  }

  createProjectProfile(workspaceSlug: string, projectId: string, payload: TPayload) {
    return this.data<ISummonProjectProfile>(
      this.post(`${this.root(workspaceSlug)}/projects/${projectId}/profile/`, payload)
    );
  }

  updateProjectProfile(workspaceSlug: string, projectId: string, payload: TPayload) {
    return this.data<ISummonProjectProfile>(
      this.patch(`${this.root(workspaceSlug)}/projects/${projectId}/profile/`, payload)
    );
  }

  listMeetings(workspaceSlug: string) {
    return this.data<ISummonMeeting[]>(this.get(`${this.root(workspaceSlug)}/meetings/`));
  }

  createMeeting(workspaceSlug: string, payload: TPayload) {
    return this.data<ISummonMeeting>(this.post(`${this.root(workspaceSlug)}/meetings/`, payload));
  }

  getMeeting(workspaceSlug: string, meetingId: string) {
    return this.data<ISummonMeeting>(this.get(`${this.root(workspaceSlug)}/meetings/${meetingId}/`));
  }

  updateMeeting(workspaceSlug: string, meetingId: string, payload: TPayload) {
    return this.data<ISummonMeeting>(this.patch(`${this.root(workspaceSlug)}/meetings/${meetingId}/`, payload));
  }

  deleteMeeting(workspaceSlug: string, meetingId: string) {
    return this.data<void>(this.delete(`${this.root(workspaceSlug)}/meetings/${meetingId}/`));
  }

  summarizeMeeting(workspaceSlug: string, meetingId: string, payload: ISummonMeetingSummaryRequest) {
    return this.data<ISummonMeeting>(this.post(`${this.root(workspaceSlug)}/meetings/${meetingId}/summary/`, payload));
  }

  listMeetingWorkItems(workspaceSlug: string, meetingId: string) {
    return this.data<ISummonMeetingWorkItem[]>(
      this.get(`${this.root(workspaceSlug)}/meetings/${meetingId}/work-items/`)
    );
  }

  linkMeetingIssue(workspaceSlug: string, meetingId: string, issueId: string) {
    return this.data<ISummonMeetingWorkItem>(
      this.post(`${this.root(workspaceSlug)}/meetings/${meetingId}/work-items/`, { issue: issueId })
    );
  }

  unlinkMeetingIssue(workspaceSlug: string, meetingId: string, workItemId: string) {
    return this.data<void>(this.delete(`${this.root(workspaceSlug)}/meetings/${meetingId}/work-items/${workItemId}/`));
  }

  listPageContexts(workspaceSlug: string) {
    return this.data<ISummonPageContext[]>(this.get(`${this.root(workspaceSlug)}/page-contexts/`));
  }

  createPageContext(workspaceSlug: string, payload: TPayload) {
    return this.data<ISummonPageContext>(this.post(`${this.root(workspaceSlug)}/page-contexts/`, payload));
  }

  getPageContext(workspaceSlug: string, contextId: string) {
    return this.data<ISummonPageContext>(this.get(`${this.root(workspaceSlug)}/page-contexts/${contextId}/`));
  }

  updatePageContext(workspaceSlug: string, contextId: string, payload: TPayload) {
    return this.data<ISummonPageContext>(
      this.patch(`${this.root(workspaceSlug)}/page-contexts/${contextId}/`, payload)
    );
  }

  deletePageContext(workspaceSlug: string, contextId: string) {
    return this.data<void>(this.delete(`${this.root(workspaceSlug)}/page-contexts/${contextId}/`));
  }

  listProjectIssues(workspaceSlug: string, projectId: string) {
    return this.data<TIssue[]>(this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/`));
  }

  listResources(workspaceSlug: string) {
    return this.data<ISummonResourceLink[]>(this.get(`${this.root(workspaceSlug)}/resources/`));
  }

  createResource(workspaceSlug: string, payload: TPayload) {
    return this.data<ISummonResourceLink>(this.post(`${this.root(workspaceSlug)}/resources/`, payload));
  }

  getResource(workspaceSlug: string, resourceId: string) {
    return this.data<ISummonResourceLink>(this.get(`${this.root(workspaceSlug)}/resources/${resourceId}/`));
  }

  updateResource(workspaceSlug: string, resourceId: string, payload: TPayload) {
    return this.data<ISummonResourceLink>(this.patch(`${this.root(workspaceSlug)}/resources/${resourceId}/`, payload));
  }

  deleteResource(workspaceSlug: string, resourceId: string) {
    return this.data<void>(this.delete(`${this.root(workspaceSlug)}/resources/${resourceId}/`));
  }

  private reportUrl(workspaceSlug: string, path: string, filters: ISummonReportFilters = {}) {
    const params = new URLSearchParams();
    if (filters.projectId) params.set("project_id", filters.projectId);
    if (filters.clientId) params.set("client_id", filters.clientId);
    if (filters.dateFrom) params.set("date_from", filters.dateFrom);
    if (filters.dateTo) params.set("date_to", filters.dateTo);
    const query = params.toString();
    return `${this.root(workspaceSlug)}/reports/${path}${query ? `?${query}` : ""}`;
  }

  getReport(workspaceSlug: string, filters?: ISummonReportFilters) {
    return this.data<ISummonReportSummary>(this.get(this.reportUrl(workspaceSlug, "summary/", filters)));
  }

  getReportExportUrl(workspaceSlug: string, filters?: ISummonReportFilters) {
    return this.reportUrl(workspaceSlug, "export.csv", filters);
  }

  listAutomationTemplates(workspaceSlug: string) {
    return this.data<ISummonAutomationTemplate[]>(this.get(`${this.root(workspaceSlug)}/automation/templates/`));
  }

  createAutomationTemplate(workspaceSlug: string, payload: TPayload) {
    return this.data<ISummonAutomationTemplate>(
      this.post(`${this.root(workspaceSlug)}/automation/templates/`, payload)
    );
  }

  getAutomationTemplate(workspaceSlug: string, templateId: string) {
    return this.data<ISummonAutomationTemplate>(
      this.get(`${this.root(workspaceSlug)}/automation/templates/${templateId}/`)
    );
  }

  updateAutomationTemplate(workspaceSlug: string, templateId: string, payload: TPayload) {
    return this.data<ISummonAutomationTemplate>(
      this.patch(`${this.root(workspaceSlug)}/automation/templates/${templateId}/`, payload)
    );
  }

  deleteAutomationTemplate(workspaceSlug: string, templateId: string) {
    return this.data<void>(this.delete(`${this.root(workspaceSlug)}/automation/templates/${templateId}/`));
  }

  listAutomationJobs(workspaceSlug: string) {
    return this.data<ISummonAutomationJob[]>(this.get(`${this.root(workspaceSlug)}/automation/jobs/`));
  }

  getAutomationJob(workspaceSlug: string, jobId: string) {
    return this.data<ISummonAutomationJob>(this.get(`${this.root(workspaceSlug)}/automation/jobs/${jobId}/`));
  }

  generateAutomationPreview(workspaceSlug: string, payload: ISummonAutomationPreviewRequest) {
    return this.data<ISummonAutomationJob>(this.post(`${this.root(workspaceSlug)}/automation/jobs/`, payload));
  }

  extractAutomationContext(workspaceSlug: string, file: File) {
    const form = new FormData();
    form.append("file", file);
    return this.data<{ name: string; text: string; truncated: boolean }>(
      this.post(`${this.root(workspaceSlug)}/automation/context/extract/`, form)
    );
  }

  publishAutomationJob(workspaceSlug: string, jobId: string) {
    return this.data<ISummonAutomationJob>(
      this.post(`${this.root(workspaceSlug)}/automation/jobs/${jobId}/publish/`, {})
    );
  }

  renderAutomationJob(workspaceSlug: string, jobId: string) {
    return this.data<ISummonAutomationJob>(
      this.post(`/api/workspaces/${workspaceSlug}/summon/automation-jobs/${jobId}/render/`, {})
    );
  }

  listAssistantConversations(workspaceSlug: string) {
    return this.data<ISummonAssistantConversation[]>(this.get(`${this.root(workspaceSlug)}/assistant/conversations/`));
  }

  createAssistantConversation(
    workspaceSlug: string,
    payload: Pick<ISummonAssistantConversation, "title" | "project" | "client"> &
      Partial<Pick<ISummonAssistantConversation, "mcp_credential">>
  ) {
    return this.data<ISummonAssistantConversation>(
      this.post(`${this.root(workspaceSlug)}/assistant/conversations/`, payload)
    );
  }

  getAssistantConversation(workspaceSlug: string, conversationId: string) {
    return this.data<ISummonAssistantConversation>(
      this.get(`${this.root(workspaceSlug)}/assistant/conversations/${conversationId}/`)
    );
  }

  updateAssistantConversation(
    workspaceSlug: string,
    conversationId: string,
    payload: Partial<Pick<ISummonAssistantConversation, "title" | "project" | "client" | "mcp_credential">>
  ) {
    return this.data<ISummonAssistantConversation>(
      this.patch(`${this.root(workspaceSlug)}/assistant/conversations/${conversationId}/`, payload)
    );
  }

  sendAssistantMessage(workspaceSlug: string, conversationId: string, payload: ISummonAssistantMessageRequest) {
    return this.data<ISummonAssistantMessagePair>(
      this.post(`${this.root(workspaceSlug)}/assistant/conversations/${conversationId}/messages/`, payload)
    );
  }

  confirmAssistantAction(workspaceSlug: string, conversationId: string, actionId: string) {
    return this.data<ISummonAssistantAction>(
      this.post(
        `${this.root(workspaceSlug)}/assistant/conversations/${conversationId}/actions/${actionId}/confirm/`,
        {}
      )
    );
  }

  cancelAssistantAction(workspaceSlug: string, conversationId: string, actionId: string) {
    return this.data<ISummonAssistantAction>(
      this.post(`${this.root(workspaceSlug)}/assistant/conversations/${conversationId}/actions/${actionId}/cancel/`, {})
    );
  }

  getWorkspaceSettings(workspaceSlug: string) {
    return this.data<ISummonWorkspaceSettings>(this.get(`${this.root(workspaceSlug)}/settings/workspace/`));
  }

  getMCPStatus(workspaceSlug: string) {
    return this.data<ISummonMCPStatus>(this.get(`${this.root(workspaceSlug)}/settings/mcp-status/`));
  }

  updateWorkspaceSettings(workspaceSlug: string, payload: Partial<ISummonWorkspaceSettings>) {
    return this.data<ISummonWorkspaceSettings>(this.patch(`${this.root(workspaceSlug)}/settings/workspace/`, payload));
  }

  listCredentials(workspaceSlug: string) {
    return this.data<ISummonCredential[]>(this.get(`${this.root(workspaceSlug)}/credentials/`));
  }

  createCredential(workspaceSlug: string, payload: TPayload) {
    return this.data<ISummonCredential>(this.post(`${this.root(workspaceSlug)}/credentials/`, payload));
  }

  getCredential(workspaceSlug: string, credentialId: string) {
    return this.data<ISummonCredential>(this.get(`${this.root(workspaceSlug)}/credentials/${credentialId}/`));
  }

  updateCredential(workspaceSlug: string, credentialId: string, payload: TPayload) {
    return this.data<ISummonCredential>(
      this.patch(`${this.root(workspaceSlug)}/credentials/${credentialId}/`, payload)
    );
  }

  deleteCredential(workspaceSlug: string, credentialId: string, password: string) {
    return this.data<void>(this.delete(`${this.root(workspaceSlug)}/credentials/${credentialId}/`, { password }));
  }

  revealCredential(workspaceSlug: string, credentialId: string, password: string) {
    return this.data<{ secret: string }>(
      this.post(`${this.root(workspaceSlug)}/credentials/${credentialId}/reveal/`, { password })
    );
  }

  rotateCredential(workspaceSlug: string, credentialId: string, password: string, secret: string) {
    return this.data<ISummonCredential>(
      this.post(`${this.root(workspaceSlug)}/credentials/${credentialId}/rotate/`, { password, secret })
    );
  }

  listCredentialGrants(workspaceSlug: string, credentialId: string) {
    return this.data<ISummonCredentialGrant[]>(
      this.get(`${this.root(workspaceSlug)}/credentials/${credentialId}/grants/`)
    );
  }

  grantCredential(workspaceSlug: string, credentialId: string, payload: TPayload) {
    return this.data<ISummonCredentialGrant>(
      this.post(`${this.root(workspaceSlug)}/credentials/${credentialId}/grants/`, payload)
    );
  }

  revokeCredentialGrant(workspaceSlug: string, credentialId: string, grantId: string) {
    return this.data<void>(this.delete(`${this.root(workspaceSlug)}/credentials/${credentialId}/grants/${grantId}/`));
  }

  listCredentialAudit(workspaceSlug: string, credentialId: string) {
    return this.data<ISummonCredentialAudit[]>(
      this.get(`${this.root(workspaceSlug)}/credentials/${credentialId}/audit/`)
    );
  }
}

export const summonService = new SummonService();
