# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.summon.views import (
    AssistantActionView,
    AssistantConversationViewSet,
    AssistantMessageView,
    AssistantQueryView,
    AutomationContextExtractView,
    AutomationJobView,
    AutomationPublishView,
    AutomationTemplateViewSet,
    ClientContactViewSet,
    ClientViewSet,
    CredentialAuditView,
    CredentialGrantDetailView,
    CredentialGrantView,
    CredentialRevealView,
    CredentialRotateView,
    CredentialViewSet,
    HomeSummaryView,
    LLMStatusView,
    MCPStatusView,
    MeetingSummaryView,
    MeetingViewSet,
    MeetingWorkItemDetailView,
    MeetingWorkItemView,
    OpportunityTransitionView,
    OpportunityViewSet,
    ProjectOverviewView,
    ReportExportView,
    ResourceLinkViewSet,
    ReportSummaryView,
    SummonPageContextViewSet,
    SummonProjectProfileView,
    SummonWorkspaceSettingsView,
)


client_list = ClientViewSet.as_view({"get": "list", "post": "create"})
client_detail = ClientViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"})
contact_list = ClientContactViewSet.as_view({"get": "list", "post": "create"})
contact_detail = ClientContactViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"})
opportunity_list = OpportunityViewSet.as_view({"get": "list", "post": "create"})
opportunity_detail = OpportunityViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"})
meeting_list = MeetingViewSet.as_view({"get": "list", "post": "create"})
meeting_detail = MeetingViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"})
page_context_list = SummonPageContextViewSet.as_view({"get": "list", "post": "create"})
page_context_detail = SummonPageContextViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)
resource_list = ResourceLinkViewSet.as_view({"get": "list", "post": "create"})
resource_detail = ResourceLinkViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"})
automation_template_list = AutomationTemplateViewSet.as_view({"get": "list", "post": "create"})
automation_template_detail = AutomationTemplateViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)
credential_list = CredentialViewSet.as_view({"get": "list", "post": "create"})
credential_detail = CredentialViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"})
assistant_conversation_list = AssistantConversationViewSet.as_view({"get": "list", "post": "create"})
assistant_conversation_detail = AssistantConversationViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)

urlpatterns = [
    path(
        "workspaces/<str:slug>/assistant/conversations/",
        assistant_conversation_list,
        name="summon-assistant-conversation-list",
    ),
    path(
        "workspaces/<str:slug>/assistant/conversations/<uuid:pk>/",
        assistant_conversation_detail,
        name="summon-assistant-conversation-detail",
    ),
    path(
        "workspaces/<str:slug>/assistant/conversations/<uuid:conversation_id>/messages/",
        AssistantMessageView.as_view(),
        name="summon-assistant-message-list",
    ),
    path(
        "workspaces/<str:slug>/assistant/conversations/<uuid:conversation_id>/actions/<uuid:action_id>/confirm/",
        AssistantActionView.as_view(),
        {"operation": "confirm"},
        name="summon-assistant-action-confirm",
    ),
    path(
        "workspaces/<str:slug>/assistant/conversations/<uuid:conversation_id>/actions/<uuid:action_id>/cancel/",
        AssistantActionView.as_view(),
        {"operation": "cancel"},
        name="summon-assistant-action-cancel",
    ),
    path("workspaces/<str:slug>/home/summary/", HomeSummaryView.as_view(), name="summon-home-summary"),
    path(
        "workspaces/<str:slug>/settings/ai-status/",
        LLMStatusView.as_view(),
        name="summon-ai-status",
    ),
    path(
        "workspaces/<str:slug>/settings/workspace/",
        SummonWorkspaceSettingsView.as_view(),
        name="summon-workspace-settings",
    ),
    path(
        "workspaces/<str:slug>/settings/mcp-status/",
        MCPStatusView.as_view(),
        name="summon-mcp-status",
    ),
    path("workspaces/<str:slug>/clients/", client_list, name="summon-client-list"),
    path("workspaces/<str:slug>/clients/<uuid:pk>/", client_detail, name="summon-client-detail"),
    path(
        "workspaces/<str:slug>/clients/<uuid:client_id>/contacts/",
        contact_list,
        name="summon-client-contact-list",
    ),
    path(
        "workspaces/<str:slug>/clients/<uuid:client_id>/contacts/<uuid:pk>/",
        contact_detail,
        name="summon-client-contact-detail",
    ),
    path("workspaces/<str:slug>/opportunities/", opportunity_list, name="summon-opportunity-list"),
    path(
        "workspaces/<str:slug>/opportunities/<uuid:pk>/",
        opportunity_detail,
        name="summon-opportunity-detail",
    ),
    path(
        "workspaces/<str:slug>/opportunities/<uuid:pk>/transitions/",
        OpportunityTransitionView.as_view(),
        name="summon-opportunity-transition",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/profile/",
        SummonProjectProfileView.as_view(),
        name="summon-project-profile",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/overview/",
        ProjectOverviewView.as_view(),
        name="summon-project-overview",
    ),
    path("workspaces/<str:slug>/meetings/", meeting_list, name="summon-meeting-list"),
    path("workspaces/<str:slug>/meetings/<uuid:pk>/", meeting_detail, name="summon-meeting-detail"),
    path(
        "workspaces/<str:slug>/meetings/<uuid:meeting_id>/summary/",
        MeetingSummaryView.as_view(),
        name="summon-meeting-summary",
    ),
    path(
        "workspaces/<str:slug>/meetings/<uuid:meeting_id>/work-items/",
        MeetingWorkItemView.as_view(),
        name="summon-meeting-work-item-list",
    ),
    path(
        "workspaces/<str:slug>/meetings/<uuid:meeting_id>/work-items/<uuid:pk>/",
        MeetingWorkItemDetailView.as_view(),
        name="summon-meeting-work-item-detail",
    ),
    path("workspaces/<str:slug>/page-contexts/", page_context_list, name="summon-page-context-list"),
    path(
        "workspaces/<str:slug>/page-contexts/<uuid:pk>/",
        page_context_detail,
        name="summon-page-context-detail",
    ),
    path("workspaces/<str:slug>/resources/", resource_list, name="summon-resource-list"),
    path("workspaces/<str:slug>/resources/<uuid:pk>/", resource_detail, name="summon-resource-detail"),
    path(
        "workspaces/<str:slug>/automation/templates/",
        automation_template_list,
        name="summon-automation-template-list",
    ),
    path(
        "workspaces/<str:slug>/automation/templates/<uuid:pk>/",
        automation_template_detail,
        name="summon-automation-template-detail",
    ),
    path(
        "workspaces/<str:slug>/automation/context/extract/",
        AutomationContextExtractView.as_view(),
        name="summon-automation-context-extract",
    ),
    path(
        "workspaces/<str:slug>/automation/jobs/",
        AutomationJobView.as_view(),
        name="summon-automation-job-list",
    ),
    path(
        "workspaces/<str:slug>/automation/jobs/<uuid:job_id>/publish/",
        AutomationPublishView.as_view(),
        name="summon-automation-job-publish",
    ),
    path(
        "workspaces/<str:slug>/reports/summary/",
        ReportSummaryView.as_view(),
        name="summon-report-summary",
    ),
    path(
        "workspaces/<str:slug>/reports/export.csv",
        ReportExportView.as_view(),
        name="summon-report-export",
    ),
    path(
        "workspaces/<str:slug>/assistant/query/",
        AssistantQueryView.as_view(),
        name="summon-assistant-query",
    ),
    path("workspaces/<str:slug>/credentials/", credential_list, name="summon-credential-list"),
    path(
        "workspaces/<str:slug>/credentials/<uuid:pk>/",
        credential_detail,
        name="summon-credential-detail",
    ),
    path(
        "workspaces/<str:slug>/credentials/<uuid:credential_id>/reveal/",
        CredentialRevealView.as_view(),
        name="summon-credential-reveal",
    ),
    path(
        "workspaces/<str:slug>/credentials/<uuid:credential_id>/rotate/",
        CredentialRotateView.as_view(),
        name="summon-credential-rotate",
    ),
    path(
        "workspaces/<str:slug>/credentials/<uuid:credential_id>/grants/",
        CredentialGrantView.as_view(),
        name="summon-credential-grant-list",
    ),
    path(
        "workspaces/<str:slug>/credentials/<uuid:credential_id>/grants/<uuid:pk>/",
        CredentialGrantDetailView.as_view(),
        name="summon-credential-grant-detail",
    ),
    path(
        "workspaces/<str:slug>/credentials/<uuid:credential_id>/audit/",
        CredentialAuditView.as_view(),
        name="summon-credential-audit",
    ),
]
