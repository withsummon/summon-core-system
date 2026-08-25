import { MessageSquareText, Plus } from "lucide-react";
import { Button } from "@plane/ui";
import type { ISummonAssistantConversation } from "@plane/types";
import { SummonRequestState } from "@/components/summon/request-state";

interface AssistantConversationSidebarProps {
  conversations: ISummonAssistantConversation[];
  activeConversationId: string;
  loading: boolean;
  creating: boolean;
  error: unknown;
  onCreate: () => void;
  onRetry: () => void;
  onSelect: (conversation: ISummonAssistantConversation) => void;
}

export function AssistantConversationSidebar(props: AssistantConversationSidebarProps) {
  return (
    <aside className="flex max-h-64 min-h-0 flex-col rounded-2xl border border-subtle bg-surface-1 p-3 lg:h-[calc(100dvh-10.5rem)] lg:max-h-none">
      <div className="flex items-center justify-between gap-2 border-b border-subtle pb-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-primary">Chats</h2>
          <p className="truncate text-[11px] text-secondary">Private to you</p>
        </div>
        <Button
          size="sm"
          variant="neutral-primary"
          loading={props.creating}
          onClick={props.onCreate}
          aria-label="New chat"
        >
          <Plus className="size-3.5" /> New
        </Button>
      </div>
      <div className="mt-3 min-h-0 space-y-1 overflow-y-auto">
        <SummonRequestState
          loading={props.loading}
          error={props.error}
          empty={!props.loading && props.conversations.length === 0}
          emptyMessage="No conversations yet."
          onRetry={props.onRetry}
        />
        {props.conversations.map((conversation) => (
          <button
            key={conversation.id}
            type="button"
            onClick={() => props.onSelect(conversation)}
            className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left focus-visible:outline focus-visible:outline-2 ${
              conversation.id === props.activeConversationId
                ? "bg-layer-1-selected text-primary"
                : "text-secondary hover:bg-layer-1-hover"
            }`}
          >
            <MessageSquareText className="size-4 flex-none" />
            <span className="text-sm truncate font-medium">{conversation.title}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
