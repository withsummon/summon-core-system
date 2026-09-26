import { useEffect, useRef, useState } from "react";
import { useAuthToken } from "@convex-dev/auth/react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Doc, Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { shouldSubmitAssistantComposer } from "@/app/(all)/[workspaceSlug]/(projects)/summon/assistant/composer-keyboard.js";
import { DeleteRecord, mutationMessage } from "../commercial/forms";
import { ConversationForm } from "./conversation-form";
import { ConversationActions } from "./actions";
import { requestAssistantReply } from "./reply";
export function Conversation({
  conversationId,
  workspaceId,
  onRemoved,
  canWrite,
}: {
  conversationId: string;
  workspaceId: Id<"workspaces">;
  onRemoved: () => void;
  canWrite: boolean;
}) {
  const conversation = useQuery(api.assistant.index.resolve, { conversationId });
  if (conversation && conversation.workspaceId !== workspaceId)
    throw new Error("Conversation belongs to another workspace.");
  if (!conversation) return <p role="status">Opening conversation…</p>;
  return (
    <ConversationContent key={conversation._id} conversation={conversation} onRemoved={onRemoved} canWrite={canWrite} />
  );
}
function ConversationContent({
  conversation,
  onRemoved,
  canWrite,
}: {
  conversation: Doc<"assistantConversations">;
  onRemoved: () => void;
  canWrite: boolean;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.assistant.index.messages,
    { conversationId: conversation._id },
    { initialNumItems: 30 }
  );
  const remove = useMutation(api.assistant.index.remove);
  const [editing, setEditing] = useState(false);
  // ES2022 consumers do not include Array.toReversed.
  // oxlint-disable-next-line unicorn/no-array-reverse
  const chronological = [...results].reverse();
  return (
    <section className="min-w-0 space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-subtle-1 pb-4">
        <div className="min-w-0">
          <p className="text-xs text-secondary">Private conversation</p>
          <h2 className="text-xl font-semibold break-words">{conversation.title}</h2>
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={Boolean(conversation.activeMessageId)}
              onClick={() => setEditing((value) => !value)}
            >
              Conversation settings
            </Button>
            <DeleteRecord
              label="conversation"
              onDelete={async () => {
                await remove({ conversationId: conversation._id });
                onRemoved();
              }}
            />
          </div>
        )}
      </header>
      {editing && canWrite && (
        <ConversationForm
          workspaceId={conversation.workspaceId}
          conversation={conversation}
          contextLocked={status === "LoadingFirstPage" || results.length > 0}
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      )}
      {status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => loadMore(30)}>
          Load older messages
        </Button>
      )}
      <div className="min-h-56 space-y-5" aria-label="Conversation messages">
        {status === "LoadingFirstPage" && <p role="status">Loading messages…</p>}
        {status === "Exhausted" && !results.length && (
          <div className="grid min-h-56 place-content-center text-center">
            <h3 className="text-lg font-medium">What would you like to know?</h3>
            <p className="text-sm mt-2 text-secondary">Ask about the context selected for this conversation.</p>
          </div>
        )}
        {chronological.map((message) => (
          <Message key={message._id} message={message} />
        ))}
      </div>
      {canWrite && (
        <>
          <Composer conversation={conversation} />
          <ConversationActions conversation={conversation} />
        </>
      )}
    </section>
  );
}
function Message({ message }: { message: Doc<"assistantMessages"> }) {
  return (
    <article
      className={`max-w-3xl rounded-xl p-4 ${message.role === "user" ? "ml-auto bg-accent-subtle" : "border border-subtle-1"}`}
    >
      <div className="text-xs mb-2 flex flex-wrap justify-between gap-2 text-secondary">
        <span>{message.role === "user" ? "You" : "Summon Assistant"}</span>
        {message.role === "assistant" && (
          <span role={message.status === "streaming" ? "status" : undefined}>{message.status}</span>
        )}
      </div>
      <div className="text-sm leading-relaxed break-words whitespace-pre-wrap">{message.content}</div>
      {message.error && (
        <p role="alert" className="text-sm mt-3 text-danger-primary">
          {message.error}
        </p>
      )}
      {message.role === "assistant" && message.citations.length > 0 && (
        <details className="text-xs mt-3 text-secondary">
          <summary className="cursor-pointer">Sources · {message.citations.length}</summary>
          <ul className="mt-2 space-y-1">
            {message.citations.map((source) => (
              <li key={`${source.kind}:${source.id}`}>
                {source.label} · {source.kind}
              </li>
            ))}
          </ul>
        </details>
      )}
      {message.contextTruncated && (
        <p className="text-xs mt-2 text-secondary">Some selected context exceeded this reply’s size limit.</p>
      )}
    </article>
  );
}
function Composer({ conversation }: { conversation: Doc<"assistantConversations"> }) {
  const token = useAuthToken();
  const cancel = useMutation(api.assistant.index.cancelReply);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const siteUrl = import.meta.env.VITE_CONVEX_SITE_URL;
  return (
    <form
      className="rounded-xl border border-subtle-1 bg-surface-1 p-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!token || !siteUrl || sending || conversation.activeMessageId) return;
        const controller = new AbortController();
        request.current = controller;
        setSending(true);
        setError("");
        try {
          await requestAssistantReply({
            siteUrl,
            token,
            conversationId: conversation._id,
            content,
            signal: controller.signal,
            onAccepted: () => setContent(""),
          });
        } catch (failure) {
          if (!controller.signal.aborted)
            setError(failure instanceof Error ? failure.message : "The reply could not be completed.");
        } finally {
          if (!controller.signal.aborted) setSending(false);
        }
      }}
    >
      <label htmlFor="assistant-message" className="sr-only">
        Message Summon Assistant
      </label>
      <textarea
        id="assistant-message"
        className="text-sm min-h-24 w-full resize-y bg-transparent p-2 outline-none"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        maxLength={20000}
        required
        placeholder="Ask Summon Assistant…"
        onKeyDown={(event) => {
          if (
            shouldSubmitAssistantComposer({
              key: event.key,
              shiftKey: event.shiftKey,
              isComposing: event.nativeEvent.isComposing,
            })
          ) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-secondary">Shift + Enter for a new line</span>
        <Button
          type="submit"
          loading={sending}
          disabled={!siteUrl || !token || Boolean(conversation.activeMessageId) || !content.trim()}
        >
          Send
        </Button>
      </div>
      {conversation.activeMessageId && (
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await cancel({ conversationId: conversation._id });
              request.current?.abort();
              setSending(false);
            } catch (failure) {
              setError(mutationMessage(failure));
            }
          }}
        >
          Stop reply
        </Button>
      )}
      {!siteUrl && (
        <p role="alert" className="text-sm mt-2 text-danger-primary">
          The assistant endpoint is not configured.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm mt-2 text-danger-primary">
          {error}
        </p>
      )}
    </form>
  );
}
