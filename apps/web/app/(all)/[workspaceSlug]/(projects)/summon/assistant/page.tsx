/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Plus, Send } from "lucide-react";
import { Button, Input, TextArea } from "@plane/ui";
import type { ISummonAssistantMessageRequest } from "@plane/types";
import { SummonField, SummonSelect } from "@/components/summon/forms";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonCard, SummonScreen, summonErrorMessage } from "@/components/summon/screen";
import { useProject } from "@/hooks/store/use-project";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";
import { AssistantMessageList, assistantErrorMessage } from "./message-list";

export default function SummonAssistantPage({ params }: Route.ComponentProps) {
  const { joinedProjectIds, getProjectById } = useProject();
  const { mutate: mutateConversationCache } = useSWRConfig();
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [composer, setComposer] = useState("");
  const [workspaceContext, setWorkspaceContext] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [clientId, setClientId] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const [pageIds, setPageIds] = useState<string[]>([]);
  const [mcpCredentialId, setMcpCredentialId] = useState("");
  const [toolMode, setToolMode] = useState("chat");
  const [workItemId, setWorkItemId] = useState("");
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState("");
  const [sendError, setSendError] = useState("");
  const [lastRequest, setLastRequest] = useState<ISummonAssistantMessageRequest>();
  const [contextTruncated, setContextTruncated] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const {
    data: conversations = [],
    error: conversationsError,
    isLoading: conversationsLoading,
    mutate: reloadConversations,
  } = useSWR(["summon-assistant-conversations", params.workspaceSlug], () =>
    summonService.listAssistantConversations(params.workspaceSlug)
  );
  const activeConversationId = selectedConversationId || conversations[0]?.id || "";
  const {
    data: conversation,
    error: conversationError,
    isLoading: conversationLoading,
    mutate: reloadConversation,
  } = useSWR(
    activeConversationId ? ["summon-assistant-conversation", params.workspaceSlug, activeConversationId] : null,
    () => summonService.getAssistantConversation(params.workspaceSlug, activeConversationId)
  );
  const { data: contextOptions, error: contextError } = useSWR(
    ["summon-assistant-context", params.workspaceSlug],
    async () => {
      const [clients, meetings, pages, credentials] = await Promise.all([
        summonService.listClients(params.workspaceSlug),
        summonService.listMeetings(params.workspaceSlug),
        summonService.listPageContexts(params.workspaceSlug),
        summonService.listCredentials(params.workspaceSlug),
      ]);
      return {
        clients,
        meetings,
        pages,
        credentials: credentials.filter(
          (credential) => credential.status === "active" && ["plane", "plane_mcp"].includes(credential.provider)
        ),
      };
    }
  );
  const messages = conversation?.messages ?? [];
  const lastMessage = messages.at(-1);
  const providerMessage = lastMessage?.role === "assistant" ? lastMessage : undefined;

  const createConversation = async (title = "New conversation") => {
    const created = await summonService.createAssistantConversation(params.workspaceSlug, {
      title,
      project: projectId || null,
      client: clientId || null,
      mcp_credential: mcpCredentialId || null,
    });
    setSelectedConversationId(created.id);
    setContextTruncated(false);
    await reloadConversations();
    return created.id;
  };

  const startConversation = async () => {
    setCreating(true);
    setSendError("");
    try {
      await createConversation();
    } catch (error) {
      setSendError(summonErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const sendMessage = async (payload: ISummonAssistantMessageRequest) => {
    if (sending) return;
    setSending(true);
    setPending(payload.content);
    setSendError("");
    setContextTruncated(false);
    let conversationId = activeConversationId;
    try {
      conversationId ||= await createConversation(payload.content.slice(0, 80));
      if (payload.tool && conversationId && conversation?.mcp_credential !== (mcpCredentialId || null)) {
        await summonService.updateAssistantConversation(params.workspaceSlug, conversationId, {
          mcp_credential: mcpCredentialId || null,
        });
      }
      const pair = await summonService.sendAssistantMessage(params.workspaceSlug, conversationId, payload);
      setComposer("");
      setLastRequest(undefined);
      setContextTruncated(pair.context_truncated);
    } catch (error) {
      setSendError(assistantErrorMessage(error));
      setLastRequest(payload);
    } finally {
      await Promise.allSettled([
        reloadConversations(),
        conversationId
          ? mutateConversationCache(["summon-assistant-conversation", params.workspaceSlug, conversationId])
          : Promise.resolve(),
      ]);
      setPending("");
      setSending(false);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const content = composer.trim();
    if (!content) return setSendError("Enter a message before sending.");
    const toolPayload =
      toolMode === "list_projects"
        ? { tool: "project", arguments: { action: "list" } }
        : toolMode === "create_project"
          ? { tool: "project", arguments: { action: "create", name: content } }
          : toolMode === "list_work_items"
            ? { tool: "workitem", arguments: { action: "list", project_id: projectId } }
            : toolMode === "create_work_item"
              ? { tool: "workitem", arguments: { action: "create", project_id: projectId, name: content } }
              : toolMode === "update_work_item"
                ? {
                    tool: "workitem",
                    arguments: { action: "update", project_id: projectId, work_item_id: workItemId, name: content },
                  }
                : toolMode === "add_comment"
                  ? {
                      tool: "workitem_comment",
                      arguments: {
                        action: "create",
                        project_id: projectId,
                        work_item_id: workItemId,
                        comment_html: content,
                      },
                    }
                  : {};
    if (toolMode !== "chat" && !mcpCredentialId) return setSendError("Select an active Plane MCP credential.");
    if (["list_work_items", "create_work_item"].includes(toolMode) && !projectId)
      return setSendError("Select a project for this Plane MCP action.");
    if (["update_work_item", "add_comment"].includes(toolMode) && (!projectId || !workItemId.trim()))
      return setSendError("Select a project and enter the Plane work item ID.");
    void sendMessage({
      content,
      context: {
        workspace: workspaceContext,
        project_id: projectId || undefined,
        client_id: clientId || undefined,
        meeting_id: meetingId || undefined,
        page_ids: pageIds,
      },
      ...toolPayload,
    });
  };

  const updateAction = async (actionId: string, operation: "confirm" | "cancel") => {
    if (!activeConversationId || actionBusy) return;
    setActionBusy(actionId);
    setSendError("");
    try {
      if (operation === "confirm")
        await summonService.confirmAssistantAction(params.workspaceSlug, activeConversationId, actionId);
      else await summonService.cancelAssistantAction(params.workspaceSlug, activeConversationId, actionId);
      await reloadConversation();
    } catch (error) {
      setSendError(summonErrorMessage(error));
    } finally {
      setActionBusy("");
    }
  };

  return (
    <SummonScreen
      title="Summon Assistant"
      description="Persistent AI conversations grounded only in context you explicitly select."
      rail={
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-primary">Recent conversations</h2>
              <p className="text-xs text-secondary">Private to you in this workspace.</p>
            </div>
            <Button size="sm" variant="neutral-primary" loading={creating} onClick={() => void startConversation()}>
              <Plus className="size-3.5" /> New
            </Button>
          </div>
          <SummonRequestState
            loading={conversationsLoading}
            error={conversationsError}
            empty={!conversationsLoading && conversations.length === 0}
            emptyMessage="No conversations yet. Send a message to start one."
            onRetry={() => void reloadConversations()}
          />
          {conversations.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSelectedConversationId(item.id);
                setMcpCredentialId(item.mcp_credential ?? "");
                setSendError("");
                setContextTruncated(false);
              }}
              className={`text-sm w-full rounded-lg px-3 py-2 text-left font-medium focus-visible:outline focus-visible:outline-2 ${
                item.id === activeConversationId
                  ? "bg-layer-1-selected text-primary"
                  : "text-secondary hover:bg-layer-1-hover"
              }`}
            >
              <span className="block truncate">{item.title}</span>
            </button>
          ))}
        </div>
      }
    >
      <SummonCard className="overflow-hidden p-0">
        <header className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm truncate font-semibold text-primary">{conversation?.title ?? "New conversation"}</h2>
            <p className="text-xs truncate text-secondary">
              {providerMessage
                ? `${providerMessage.provider || "Provider unavailable"}${providerMessage.model ? ` · ${providerMessage.model}` : ""}`
                : "Provider and model appear after the first response."}
            </p>
          </div>
          {providerMessage ? (
            <span className="rounded-full bg-layer-1 px-2 py-1 text-[11px] font-medium text-secondary">
              {providerMessage.provider === "deterministic" ? "Degraded mode" : providerMessage.status}
            </span>
          ) : null}
        </header>
        <div className="min-h-72 space-y-3 overflow-y-auto p-4 lg:max-h-[32rem]">
          <SummonRequestState
            loading={Boolean(activeConversationId) && conversationLoading}
            error={conversationError}
            onRetry={() => void reloadConversation()}
          />
          <AssistantMessageList messages={messages} pending={pending} loading={conversationLoading} />
          {conversation?.actions?.map((action) => (
            <div key={action.id} className="rounded-xl border border-subtle bg-layer-1 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-primary">{action.preview.title ?? "Plane MCP action"}</p>
                  <p className="text-xs mt-1 text-secondary">{action.preview.summary ?? action.tool}</p>
                </div>
                <span className="rounded-full bg-surface-1 px-2 py-1 text-[10px] font-medium text-secondary uppercase">
                  {action.status}
                </span>
              </div>
              {action.status === "pending" ? (
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    loading={actionBusy === action.id}
                    onClick={() => void updateAction(action.id, "confirm")}
                  >
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="neutral-primary"
                    disabled={Boolean(actionBusy)}
                    onClick={() => void updateAction(action.id, "cancel")}
                  >
                    Cancel
                  </Button>
                </div>
              ) : null}
              {action.error ? <p className="text-xs mt-2 text-danger-primary">{action.error}</p> : null}
            </div>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-3 border-t border-subtle p-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <SummonField label="Assistant mode">
              <SummonSelect value={toolMode} onChange={(event) => setToolMode(event.target.value)}>
                <option value="chat">AI chat</option>
                <option value="list_projects">MCP · List projects</option>
                <option value="create_project">MCP · Create project preview</option>
                <option value="list_work_items">MCP · List work items</option>
                <option value="create_work_item">MCP · Create work item preview</option>
                <option value="update_work_item">MCP · Update work item preview</option>
                <option value="add_comment">MCP · Add comment preview</option>
              </SummonSelect>
            </SummonField>
            <SummonField label="Plane MCP credential">
              <SummonSelect value={mcpCredentialId} onChange={(event) => setMcpCredentialId(event.target.value)}>
                <option value="">No credential</option>
                {contextOptions?.credentials.map((credential) => (
                  <option key={credential.id} value={credential.id}>
                    {credential.name}
                  </option>
                ))}
              </SummonSelect>
            </SummonField>
            <SummonField label="Project context">
              <SummonSelect value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                <option value="">No project</option>
                {joinedProjectIds.map((id) => (
                  <option key={id} value={id}>
                    {getProjectById(id)?.name ?? id}
                  </option>
                ))}
              </SummonSelect>
            </SummonField>
            {["update_work_item", "add_comment"].includes(toolMode) ? (
              <SummonField label="Plane work item ID">
                <Input value={workItemId} onChange={(event) => setWorkItemId(event.target.value)} required />
              </SummonField>
            ) : null}
            <SummonField label="Client context">
              <SummonSelect value={clientId} onChange={(event) => setClientId(event.target.value)}>
                <option value="">No client</option>
                {contextOptions?.clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </SummonSelect>
            </SummonField>
            <SummonField label="Meeting context">
              <SummonSelect value={meetingId} onChange={(event) => setMeetingId(event.target.value)}>
                <option value="">No meeting</option>
                {contextOptions?.meetings.map((meeting) => (
                  <option key={meeting.id} value={meeting.id}>
                    {meeting.title}
                  </option>
                ))}
              </SummonSelect>
            </SummonField>
            <SummonField label="Plane Pages context">
              <SummonSelect
                multiple
                value={pageIds}
                onChange={(event) => setPageIds(Array.from(event.target.selectedOptions, ({ value }) => value))}
                className="h-16 py-1.5"
                aria-describedby="assistant-page-context-help"
              >
                {contextOptions?.pages.map((page) => (
                  <option key={page.id} value={page.page}>
                    {page.page_detail.name}
                  </option>
                ))}
              </SummonSelect>
            </SummonField>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs inline-flex items-center gap-2 font-medium text-secondary">
              <input
                type="checkbox"
                checked={workspaceContext}
                onChange={(event) => setWorkspaceContext(event.target.checked)}
                className="accent-accent-primary size-4"
              />
              Include workspace summary
            </label>
            <p id="assistant-page-context-help" className="text-[11px] text-tertiary">
              Use Ctrl/Command for multiple Pages. Unselected workspace data is never sent.
            </p>
          </div>
          {contextError ? <p className="text-xs text-danger-primary">Could not load every context option.</p> : null}
          {contextTruncated ? (
            <p className="text-xs rounded-lg bg-warning-subtle/20 px-3 py-2 text-warning-primary" role="status">
              Selected source context was truncated to the 30,000-character limit.
            </p>
          ) : null}
          {sendError ? (
            <div className="flex flex-wrap items-center justify-between gap-2" role="alert">
              <p className="text-xs text-danger-primary">{sendError}</p>
              {lastRequest ? (
                <Button type="button" size="sm" variant="neutral-primary" onClick={() => void sendMessage(lastRequest)}>
                  Retry message
                </Button>
              ) : null}
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <TextArea
              required
              aria-label="Message Summon Assistant"
              value={composer}
              onChange={(event) => setComposer(event.target.value)}
              placeholder="Ask about the selected project, client, meeting, or Pages…"
              className="min-h-20 flex-1"
            />
            <Button type="submit" loading={sending}>
              <Send className="size-4" /> Send
            </Button>
          </div>
        </form>
      </SummonCard>
    </SummonScreen>
  );
}
