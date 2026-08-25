/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { EFileAssetType, type ISummonAssistantMessageRequest } from "@plane/types";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonCard, SummonScreen, summonErrorMessage } from "@/components/summon/screen";
import { useProject } from "@/hooks/store/use-project";
import { FileService } from "@/services/file.service";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";
import { AssistantActionCard } from "./assistant-action-card";
import { AssistantComposer, type AssistantComposerState } from "./assistant-composer";
import { AssistantMessageList, assistantErrorMessage } from "./message-list";
import { AssistantConversationSidebar } from "./conversation-sidebar";

const fileService = new FileService();
const MAX_ATTACHMENTS = 5;
const DOCUMENT_EXTENSIONS = new Set([".pdf", ".docx", ".xlsx", ".pptx", ".txt", ".md", ".csv"]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".m4a"]);
const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
const AUDIO_MAX_BYTES = 250 * 1024 * 1024;

const extensionOf = (name: string) => name.slice(name.lastIndexOf(".")).toLowerCase();

const EMPTY_COMPOSER: AssistantComposerState = {
  content: "",
  workspaceContext: false,
  projectId: "",
  clientId: "",
  meetingId: "",
  pageIds: [],
  mcpCredentialId: "",
  toolMode: "chat",
  workItemId: "",
};

export default function SummonAssistantPage({ params }: Route.ComponentProps) {
  const { joinedProjectIds, getProjectById } = useProject();
  const { mutate: mutateConversationCache } = useSWRConfig();
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [composer, setComposer] = useState(EMPTY_COMPOSER);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState("");
  const [sendError, setSendError] = useState("");
  const [lastRequest, setLastRequest] = useState<ISummonAssistantMessageRequest>();
  const [contextTruncated, setContextTruncated] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [removingAttachment, setRemovingAttachment] = useState("");
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
    () => summonService.getAssistantConversation(params.workspaceSlug, activeConversationId),
    {
      refreshInterval: (current) =>
        current?.attachments?.some((attachment) => attachment.status === "processing") ? 3000 : 0,
    }
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
  const pendingAttachments = conversation?.attachments?.filter((attachment) => !attachment.message) ?? [];
  const lastMessage = messages.at(-1);
  const providerMessage = lastMessage?.role === "assistant" ? lastMessage : undefined;

  const createConversation = async (title = "New conversation") => {
    const created = await summonService.createAssistantConversation(params.workspaceSlug, {
      title,
      project: composer.projectId || null,
      client: composer.clientId || null,
      mcp_credential: composer.mcpCredentialId || null,
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

  const uploadAttachments = async (files: File[]) => {
    if (!files.length) return;
    if (pendingAttachments.length + uploadingFiles.length + files.length > MAX_ATTACHMENTS) {
      setSendError(`Maximum ${MAX_ATTACHMENTS} files per message.`);
      return;
    }
    for (const file of files) {
      const extension = extensionOf(file.name);
      const isAudio = AUDIO_EXTENSIONS.has(extension);
      if ((!isAudio && !DOCUMENT_EXTENSIONS.has(extension)) || file.size <= 0) {
        setSendError(`${file.name}: unsupported or empty file.`);
        return;
      }
      if (file.size > (isAudio ? AUDIO_MAX_BYTES : DOCUMENT_MAX_BYTES)) {
        setSendError(`${file.name}: maximum size is ${isAudio ? "250 MB" : "10 MB"}.`);
        return;
      }
    }

    setSendError("");
    setUploadingFiles((current) => [...current, ...files]);
    let conversationId = activeConversationId;
    try {
      conversationId ||= await createConversation("File context");
      const failures = await Promise.all(
        files.map(async (file) => {
          let assetId = "";
          try {
            const asset = await fileService.uploadWorkspaceAsset(
              params.workspaceSlug,
              { entity_identifier: conversationId, entity_type: EFileAssetType.ASSISTANT_ATTACHMENT },
              file
            );
            assetId = asset.asset_id;
            await summonService.createAssistantAttachment(params.workspaceSlug, conversationId, assetId);
            return "";
          } catch (error) {
            if (assetId) await fileService.deleteWorkspaceAsset(params.workspaceSlug, assetId).catch(() => undefined);
            return `${file.name}: ${summonErrorMessage(error)}`;
          } finally {
            setUploadingFiles((current) => current.filter((item) => item !== file));
          }
        })
      );
      const message = failures.filter(Boolean).join(" ");
      if (message) setSendError(message);
    } catch (error) {
      setSendError(summonErrorMessage(error));
      setUploadingFiles([]);
    } finally {
      await Promise.allSettled([
        reloadConversations(),
        conversationId
          ? mutateConversationCache(["summon-assistant-conversation", params.workspaceSlug, conversationId])
          : Promise.resolve(),
      ]);
    }
  };

  const removeAttachment = async (attachmentId: string) => {
    if (!activeConversationId || removingAttachment) return;
    setRemovingAttachment(attachmentId);
    setSendError("");
    try {
      await summonService.deleteAssistantAttachment(params.workspaceSlug, activeConversationId, attachmentId);
      await reloadConversation();
    } catch (error) {
      setSendError(summonErrorMessage(error));
    } finally {
      setRemovingAttachment("");
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
      if (payload.tool && conversationId && conversation?.mcp_credential !== (composer.mcpCredentialId || null)) {
        await summonService.updateAssistantConversation(params.workspaceSlug, conversationId, {
          mcp_credential: composer.mcpCredentialId || null,
        });
      }
      const pair = await summonService.sendAssistantMessage(params.workspaceSlug, conversationId, payload);
      setComposer((current) => ({ ...current, content: "" }));
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
    const content = composer.content.trim();
    if (!content) return setSendError("Enter a message before sending.");
    if (pendingAttachments.some((attachment) => attachment.status === "processing"))
      return setSendError("Wait until audio transcription is ready before sending.");
    const toolPayload =
      composer.toolMode === "list_projects"
        ? { tool: "project", arguments: { action: "list" } }
        : composer.toolMode === "create_project"
          ? { tool: "project", arguments: { action: "create", name: content } }
          : composer.toolMode === "list_work_items"
            ? { tool: "workitem", arguments: { action: "list", project_id: composer.projectId } }
            : composer.toolMode === "create_work_item"
              ? { tool: "workitem", arguments: { action: "create", project_id: composer.projectId, name: content } }
              : composer.toolMode === "update_work_item"
                ? {
                    tool: "workitem",
                    arguments: {
                      action: "update",
                      project_id: composer.projectId,
                      work_item_id: composer.workItemId,
                      name: content,
                    },
                  }
                : composer.toolMode === "add_comment"
                  ? {
                      tool: "workitem_comment",
                      arguments: {
                        action: "create",
                        project_id: composer.projectId,
                        work_item_id: composer.workItemId,
                        comment_html: content,
                      },
                    }
                  : {};
    if (composer.toolMode !== "chat" && !composer.mcpCredentialId)
      return setSendError("Select an active Plane MCP credential.");
    if (["list_work_items", "create_work_item"].includes(composer.toolMode) && !composer.projectId)
      return setSendError("Select a project for this Plane MCP action.");
    if (
      ["update_work_item", "add_comment"].includes(composer.toolMode) &&
      (!composer.projectId || !composer.workItemId.trim())
    )
      return setSendError("Select a project and enter the Plane work item ID.");
    void sendMessage({
      content,
      context: {
        workspace: composer.workspaceContext,
        project_id: composer.projectId || undefined,
        client_id: composer.clientId || undefined,
        meeting_id: composer.meetingId || undefined,
        page_ids: composer.pageIds,
      },
      attachment_ids: pendingAttachments
        .filter((attachment) => attachment.status === "ready")
        .map((attachment) => attachment.id),
      ...toolPayload,
    });
  };

  const updateAction = async (actionId: string, operation: "confirm" | "cancel" | "retry", templateId?: string) => {
    if (!activeConversationId || actionBusy) return;
    setActionBusy(actionId);
    setSendError("");
    try {
      if (templateId)
        await summonService.selectAssistantDocumentTemplate(
          params.workspaceSlug,
          activeConversationId,
          actionId,
          templateId
        );
      else if (operation === "confirm")
        await summonService.confirmAssistantAction(params.workspaceSlug, activeConversationId, actionId);
      else if (operation === "retry")
        await summonService.retryAssistantAction(params.workspaceSlug, activeConversationId, actionId);
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
      description="Chat with authorized Summon project, document, meeting, and client knowledge."
    >
      <div className="grid min-h-0 gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <AssistantConversationSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          loading={conversationsLoading}
          creating={creating}
          error={conversationsError}
          onCreate={() => void startConversation()}
          onRetry={() => void reloadConversations()}
          onSelect={(item) => {
            setSelectedConversationId(item.id);
            setComposer((current) => ({ ...current, mcpCredentialId: item.mcp_credential ?? "" }));
            setSendError("");
            setContextTruncated(false);
          }}
        />
        <SummonCard className="flex min-h-[36rem] flex-col overflow-hidden p-0 lg:h-[calc(100dvh-10.5rem)]">
          <header className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <h2 className="text-sm truncate font-semibold text-primary">
                {conversation?.title ?? "New conversation"}
              </h2>
              <p className="truncate text-[11px] text-secondary">
                {providerMessage
                  ? `${providerMessage.provider || "Provider unavailable"}${providerMessage.model ? ` · ${providerMessage.model}` : ""}`
                  : "Automatic RAG · provider appears after the first response"}
              </p>
            </div>
            {providerMessage ? (
              <span className="rounded-full bg-layer-1 px-2.5 py-1 text-[11px] font-medium text-secondary">
                {providerMessage.provider === "deterministic" ? "Degraded mode" : providerMessage.status}
              </span>
            ) : null}
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl space-y-5 px-4 py-5 sm:px-6">
              <SummonRequestState
                loading={Boolean(activeConversationId) && conversationLoading}
                error={conversationError}
                onRetry={() => void reloadConversation()}
              />
              <AssistantMessageList
                messages={messages}
                pending={pending}
                loading={conversationLoading}
                workspaceSlug={params.workspaceSlug}
                onSuggestion={(prompt) => setComposer((current) => ({ ...current, content: prompt }))}
              />
              {conversation?.actions?.map((action) => (
                <AssistantActionCard
                  key={action.id}
                  action={action}
                  busy={actionBusy === action.id}
                  anyBusy={Boolean(actionBusy)}
                  workspaceSlug={params.workspaceSlug}
                  onConfirm={() => void updateAction(action.id, "confirm")}
                  onCancel={() => void updateAction(action.id, "cancel")}
                  onRetry={() => void updateAction(action.id, "retry")}
                  onSelect={(templateId) => void updateAction(action.id, "confirm", templateId)}
                />
              ))}
            </div>
          </div>
          <AssistantComposer
            value={composer}
            projects={joinedProjectIds.map((id) => ({ id, name: getProjectById(id)?.name ?? id }))}
            clients={contextOptions?.clients}
            meetings={contextOptions?.meetings}
            pages={contextOptions?.pages}
            credentials={contextOptions?.credentials}
            sending={sending}
            contextError={Boolean(contextError)}
            contextTruncated={contextTruncated}
            sendError={sendError}
            canRetry={Boolean(lastRequest)}
            attachments={pendingAttachments}
            uploadingFiles={uploadingFiles}
            removingAttachment={removingAttachment}
            onChange={(patch) => setComposer((current) => ({ ...current, ...patch }))}
            onSubmit={submit}
            onRetry={() => lastRequest && void sendMessage(lastRequest)}
            onFiles={(files) => void uploadAttachments(files)}
            onRemoveAttachment={(attachmentId) => void removeAttachment(attachmentId)}
          />
        </SummonCard>
      </div>
    </SummonScreen>
  );
}
