/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { SquarePen } from "lucide-react";
import { Button } from "@plane/propel/button";
import { IconButton } from "@plane/propel/icon-button";
import { EFileAssetType } from "@plane/types";
import type {
  ISummonAssistantConversation,
  ISummonAssistantMessage,
  ISummonAssistantMessageRequest,
} from "@plane/types";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { SummonLogo } from "@/components/summon/brand";
import { SummonRequestState } from "@/components/summon/request-state";
import type { TOption } from "@/components/summon/option-menu";
import { SummonCard, SummonScreen, summonErrorMessage, summonLLMErrorMessage } from "@/components/summon/screen";
import { FileService } from "@/services/file.service";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";
import { AssistantActionCard } from "./assistant-action-card";
import { AssistantComposer, SCOPE_ICONS, scopeLabelFor } from "./assistant-composer";
import {
  EMPTY_COMPOSER,
  MAX_ATTACHMENTS,
  attachmentProblem,
  meetingProjectFor,
  projectForScope,
  openChat,
  buildTimeline,
  conversationScopePatch,
  scopeContext,
  scopeFromConversation,
  titleFromAnswer,
  toolPayload,
  toolProblem,
} from "./assistant-model";
import type {
  AssistantComposerState,
  AssistantWriteback,
  TAssistantScope,
  TAssistantTemplate,
} from "./assistant-model";
import { AssistantTemplates } from "./assistant-templates";
import { AssistantWritebackCard } from "./assistant-writeback-card";
import { useAssistantOptions } from "./use-assistant-options";
import { useAssistantStream } from "./use-assistant-stream";
import { AssistantConversationSidebar } from "./conversation-sidebar";
import { AssistantTimeline } from "./message-list";

const fileService = new FileService();

type TActionOperation = (workspaceSlug: string, conversationId: string, actionId: string) => Promise<unknown>;
const ACTION_OPERATIONS: Record<"confirm" | "cancel" | "retry", TActionOperation> = {
  confirm: (...args) => summonService.confirmAssistantAction(...args),
  cancel: (...args) => summonService.cancelAssistantAction(...args),
  retry: (...args) => summonService.retryAssistantAction(...args),
};

export default function SummonAssistantPage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { mutate: mutateConversationCache } = useSWRConfig();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // The open chat lives in `?chat=` so Back and reload return to it. "" is a new, unsaved chat;
  // its conversation record is created on the first send.
  const activeConversationId = searchParams.get("chat") ?? "";
  const setActiveConversationId = (id: string, mode: "push" | "replace" = "push") =>
    router[mode](id ? `${pathname}?chat=${id}` : pathname);
  // The chat whose saved scope the composer already reflects.
  const scopedConversationId = useRef("");
  const [composer, setComposer] = useState<AssistantComposerState>(() => ({
    ...EMPTY_COMPOSER,
    content: searchParams.get("q") ?? "",
  }));
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState("");
  const [sendError, setSendError] = useState("");
  const [lastRequest, setLastRequest] = useState<ISummonAssistantMessageRequest>();
  const [contextTruncated, setContextTruncated] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [removingAttachment, setRemovingAttachment] = useState("");
  const [writebacks, setWritebacks] = useState<AssistantWriteback[]>([]);

  const {
    data: conversations = [],
    error: conversationsError,
    isLoading: conversationsLoading,
    mutate: reloadConversations,
  } = useSWR(["summon-assistant-conversations", workspaceSlug], () =>
    summonService.listAssistantConversations(workspaceSlug)
  );
  const {
    data: conversation,
    error: conversationError,
    isLoading: conversationLoading,
    mutate: reloadConversation,
  } = useSWR(
    activeConversationId ? ["summon-assistant-conversation", workspaceSlug, activeConversationId] : null,
    () => summonService.getAssistantConversation(workspaceSlug, activeConversationId),
    {
      refreshInterval: (current) =>
        current?.attachments?.some((attachment) => attachment.status === "processing") ? 3000 : 0,
      // A chat reached through the URL picks up its saved scope once.
      onSuccess: (loaded) => {
        if (scopedConversationId.current === loaded.id) return;
        scopedConversationId.current = loaded.id;
        setComposer((current) => ({
          ...current,
          scope: scopeFromConversation(loaded),
          mcpCredentialId: loaded.mcp_credential ?? "",
        }));
      },
    }
  );
  const options = useAssistantOptions(workspaceSlug);
  const stream = useAssistantStream(workspaceSlug);
  // The AI service streams OpenRouter turns; Django answers other providers and tool commands in one response.
  const { data: aiStatus } = useSWR(["summon-ai-status", workspaceSlug], () =>
    summonService.getAIStatus(workspaceSlug)
  );
  const streamsReplies = aiStatus?.provider === "openrouter";
  const scopeLabel = scopeLabelFor(composer.scope, options.scopeOptions);
  const meetingProjectId = meetingProjectFor(composer.scope, options.meetings);

  const { messages, actions, pendingAttachments } = openChat(activeConversationId, conversation);
  const timeline = buildTimeline(messages, actions, writebacks);
  const isEmpty = !timeline.length && !pending && !(activeConversationId && conversationLoading);

  const resetChatState = () => {
    setSendError("");
    setContextTruncated(false);
    setLastRequest(undefined);
    setWritebacks([]);
  };

  const startNewChat = () => {
    setActiveConversationId("");
    setComposer((current) => ({ ...EMPTY_COMPOSER, scope: current.scope }));
    resetChatState();
    textareaRef.current?.focus();
  };

  const openConversation = (item: ISummonAssistantConversation) => {
    scopedConversationId.current = item.id;
    setActiveConversationId(item.id);
    setComposer({ ...EMPTY_COMPOSER, scope: scopeFromConversation(item), mcpCredentialId: item.mcp_credential ?? "" });
    resetChatState();
  };

  const createConversation = async (title: string) => {
    const created = await summonService.createAssistantConversation(workspaceSlug, {
      title,
      ...conversationScopePatch(composer.scope),
      mcp_credential: composer.mcpCredentialId || null,
    });
    scopedConversationId.current = created.id;
    setActiveConversationId(created.id, "replace");
    await reloadConversations();
    return created.id;
  };

  /** The chat remembers a project or client scope; meetings and pages focus only the next messages. */
  const changeScope = async (scope: TAssistantScope) => {
    setComposer((current) => ({ ...current, scope }));
    if (!activeConversationId) return;
    try {
      await summonService.updateAssistantConversation(
        workspaceSlug,
        activeConversationId,
        conversationScopePatch(scope)
      );
      await reloadConversations();
    } catch (error) {
      setSendError(summonErrorMessage(error));
    }
  };

  const refreshActive = (conversationId: string) =>
    Promise.allSettled([
      reloadConversations(),
      conversationId
        ? mutateConversationCache(["summon-assistant-conversation", workspaceSlug, conversationId])
        : Promise.resolve(),
    ]);

  const uploadAttachments = async (files: File[]) => {
    if (!files.length) return;
    const problem = attachmentProblem(files, pendingAttachments.length + uploadingFiles.length, MAX_ATTACHMENTS);
    if (problem) return setSendError(problem);

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
              workspaceSlug,
              { entity_identifier: conversationId, entity_type: EFileAssetType.ASSISTANT_ATTACHMENT },
              file
            );
            assetId = asset.asset_id;
            await summonService.createAssistantAttachment(workspaceSlug, conversationId, assetId);
            return "";
          } catch (error) {
            if (assetId) await fileService.deleteWorkspaceAsset(workspaceSlug, assetId).catch(() => undefined);
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
      await refreshActive(conversationId);
    }
  };

  const removeAttachment = async (attachmentId: string) => {
    if (!activeConversationId || removingAttachment) return;
    setRemovingAttachment(attachmentId);
    setSendError("");
    try {
      await summonService.deleteAssistantAttachment(workspaceSlug, activeConversationId, attachmentId);
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
    setComposer((current) => ({ ...current, content: "" }));
    setSendError("");
    setContextTruncated(false);
    let conversationId = activeConversationId;
    try {
      conversationId ||= await createConversation(payload.content.slice(0, 80));
      if (payload.tool && conversation?.mcp_credential !== (composer.mcpCredentialId || null)) {
        await summonService.updateAssistantConversation(workspaceSlug, conversationId, {
          mcp_credential: composer.mcpCredentialId || null,
        });
      }
      if (streamsReplies && !payload.tool) {
        const { failure, truncated } = await stream.send(conversationId, payload);
        // A turn that failed while answering is saved and explained in the timeline, like a blocking one.
        if (failure?.kind === "refused") {
          setSendError(summonLLMErrorMessage(failure));
          setLastRequest(payload);
        } else setLastRequest(undefined);
        setContextTruncated(truncated);
      } else {
        const pair = await summonService.sendAssistantMessage(workspaceSlug, conversationId, payload);
        setLastRequest(undefined);
        setContextTruncated(pair.context_truncated);
      }
      if (payload.tool) setComposer((current) => ({ ...current, toolMode: "chat", workItemId: "" }));
    } catch (error) {
      // A provider failure is saved as a failed answer and explained in the timeline; only offer the retry here.
      const answered = Boolean(error && typeof error === "object" && "assistant_message" in error);
      setSendError(answered ? "" : summonLLMErrorMessage(error));
      setLastRequest(payload);
    } finally {
      await refreshActive(conversationId);
      // Django's saved messages are loaded now; drop the streamed copy so the reply shows once.
      stream.clear();
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
    const problem = toolProblem(composer);
    if (problem) return setSendError(problem);
    void sendMessage({
      content,
      context: scopeContext(composer, meetingProjectId),
      attachment_ids: pendingAttachments
        .filter((attachment) => attachment.status === "ready")
        .map((attachment) => attachment.id),
      ...toolPayload(composer, content),
    });
  };

  const updateAction = async (actionId: string, operation: "confirm" | "cancel" | "retry", templateId?: string) => {
    if (!activeConversationId || actionBusy) return;
    setActionBusy(actionId);
    setSendError("");
    try {
      await (templateId
        ? summonService.selectAssistantDocumentTemplate(workspaceSlug, activeConversationId, actionId, templateId)
        : ACTION_OPERATIONS[operation](workspaceSlug, activeConversationId, actionId));
      await reloadConversation();
    } catch (error) {
      setSendError(summonErrorMessage(error));
    } finally {
      setActionBusy("");
    }
  };

  const pickTemplate = (template: TAssistantTemplate, option: TOption) => {
    void changeScope({ kind: template.scope, id: option.id });
    setComposer((current) => ({ ...current, content: template.prompt(option.label) }));
    textareaRef.current?.focus();
  };

  // A write-back starts from its answer and files into the chat's project when it has one.
  const answerFor = (writeback: AssistantWriteback) =>
    messages.find((message) => message.id === writeback.messageId)?.content ?? "";
  const writebackProjectId = projectForScope(composer.scope, meetingProjectId) ?? "";

  const startWriteback = (kind: AssistantWriteback["kind"], message: ISummonAssistantMessage) =>
    setWritebacks((current) => [
      ...current,
      {
        id: `${kind}-${message.id}-${current.length}`,
        kind,
        messageId: message.id,
        created_at: new Date().toISOString(),
      },
    ]);

  const composerElement = (
    <AssistantComposer
      value={composer}
      scopeOptions={options.scopeOptions}
      scopeLabel={scopeLabel}
      pages={options.pages}
      credentials={options.credentials}
      attachments={pendingAttachments}
      uploadingFiles={uploadingFiles}
      removingAttachment={removingAttachment}
      sending={sending}
      textareaRef={textareaRef}
      placeholder={isEmpty ? "Ask about a project, client, meeting or document…" : "Ask a follow-up…"}
      onChange={(patch) => setComposer((current) => ({ ...current, ...patch }))}
      onScopeChange={(scope) => void changeScope(scope)}
      onSubmit={submit}
      onFiles={(files) => void uploadAttachments(files)}
      onRemoveAttachment={(attachmentId) => void removeAttachment(attachmentId)}
      footer={
        <ComposerStatus
          error={sendError}
          contextError={Boolean(options.error)}
          truncated={contextTruncated}
          onRetry={lastRequest ? () => void sendMessage(lastRequest) : undefined}
        />
      }
    />
  );

  return (
    <SummonScreen
      title="Assistant"
      description="Answers from the projects, clients, meetings and files you can access, ready to turn into work."
    >
      <div className="grid min-h-0 gap-4 lg:h-[calc(100dvh-9.75rem)] lg:grid-cols-[15rem_minmax(0,1fr)]">
        <AssistantConversationSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          loading={conversationsLoading}
          error={conversationsError}
          onNew={startNewChat}
          onRetry={() => void reloadConversations()}
          onSelect={openConversation}
        />
        {/* Below lg the chat comes first and fills the screen, so the composer is never under the fold. */}
        <SummonCard className="flex h-[calc(100dvh-11rem)] min-h-[28rem] min-w-0 flex-col overflow-hidden p-0 max-lg:order-first lg:h-auto lg:min-h-0">
          {isEmpty ? null : (
            <ChatHeader
              title={(activeConversationId && conversation?.title) || "New chat"}
              scope={composer.scope}
              scopeLabel={scopeLabel}
              onNew={startNewChat}
            />
          )}
          {isEmpty ? (
            // A new chat: the composer centred, with Summon jobs under it.
            <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 py-10 sm:justify-center">
              <div className="flex w-full max-w-2xl flex-col items-center gap-6 text-center">
                <div className="flex flex-col items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-layer-2 text-primary">
                    <SummonLogo variant="mark" className="size-5" />
                  </span>
                  <div className="space-y-1">
                    <h2 className="text-20 font-semibold tracking-tight text-primary">What should Summon work on?</h2>
                    <p className="text-13 text-secondary">
                      Pick a scope, ask anything, and turn the answer into a work item, page or document.
                    </p>
                  </div>
                </div>
                {composerElement}
                <AssistantTemplates options={options.scopeOptions} onPick={pickTemplate} />
              </div>
            </div>
          ) : (
            <>
              <Conversation>
                <ConversationContent>
                  <SummonRequestState
                    loading={conversationLoading && !messages.length}
                    error={conversationError}
                    onRetry={() => void reloadConversation()}
                  />
                  <AssistantTimeline
                    items={timeline}
                    pending={pending}
                    streamingReply={stream.reply}
                    canWriteBack={options.projects.length > 0}
                    workspaceSlug={workspaceSlug}
                    onWriteback={startWriteback}
                    renderAction={({ action }) => (
                      <AssistantActionCard
                        action={action}
                        busy={actionBusy === action.id}
                        anyBusy={Boolean(actionBusy)}
                        workspaceSlug={workspaceSlug}
                        onConfirm={() => void updateAction(action.id, "confirm")}
                        onCancel={() => void updateAction(action.id, "cancel")}
                        onRetry={() => void updateAction(action.id, "retry")}
                        onSelect={(templateId) => void updateAction(action.id, "confirm", templateId)}
                      />
                    )}
                    renderWriteback={(writeback) => (
                      <AssistantWritebackCard
                        writeback={writeback}
                        markdown={answerFor(writeback)}
                        defaultTitle={titleFromAnswer(answerFor(writeback), conversation?.title ?? "Summon answer")}
                        defaultProjectId={writebackProjectId}
                        projects={options.projects}
                        workspaceSlug={workspaceSlug}
                        onDismiss={() => setWritebacks((current) => current.filter((item) => item.id !== writeback.id))}
                      />
                    )}
                  />
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>
              <div className="mx-auto w-full max-w-3xl px-4 pb-4 sm:px-6">{composerElement}</div>
            </>
          )}
        </SummonCard>
      </div>
    </SummonScreen>
  );
}

function ChatHeader(props: { title: string; scope: TAssistantScope; scopeLabel: string; onNew: () => void }) {
  const ScopeIcon = SCOPE_ICONS[props.scope.kind];
  return (
    <header className="flex min-h-12 items-center gap-3 border-b border-subtle px-4 py-2.5">
      <h2 className="min-w-0 flex-1 truncate text-13 font-semibold text-primary">{props.title}</h2>
      <span className="inline-flex max-w-[50%] items-center gap-1.5 rounded-md bg-layer-1 px-2 py-1 text-12 text-secondary">
        <ScopeIcon aria-hidden className="size-3.5 flex-none" />
        <span className="sr-only">Scope:</span>
        <span className="truncate">{props.scopeLabel}</span>
      </span>
      {/* The chat list sits below the chat on narrow screens; keep a way to start over up here. */}
      <IconButton
        variant="ghost"
        size="sm"
        icon={SquarePen}
        aria-label="New chat"
        onClick={props.onNew}
        className="lg:hidden"
      />
    </header>
  );
}

function ComposerStatus(props: { error: string; contextError: boolean; truncated: boolean; onRetry?: () => void }) {
  if (props.error || props.onRetry)
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-12 text-danger-primary">{props.error || "Your last message wasn't answered."}</p>
        {props.onRetry ? (
          <Button type="button" size="sm" variant="secondary" onClick={props.onRetry}>
            Retry message
          </Button>
        ) : null}
      </div>
    );
  if (props.truncated)
    return (
      <p role="status" className="px-1 text-12 text-warning-primary">
        Some sources were cut to fit the 30,000-character context limit. Narrow the scope for a fuller answer.
      </p>
    );
  if (props.contextError)
    return <p className="px-1 text-12 text-danger-primary">Some scope options could not be loaded.</p>;
  return (
    <p className="px-1 text-center text-12 text-tertiary">
      Summon only reads what you can access. Check important facts before you share them.
    </p>
  );
}
