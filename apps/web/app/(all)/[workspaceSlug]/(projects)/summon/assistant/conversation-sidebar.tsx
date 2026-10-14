/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { MessageSquareText, SquarePen } from "lucide-react";
import { Button } from "@plane/propel/button";
import type { ISummonAssistantConversation } from "@plane/types";
import { cn } from "@plane/utils";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonPanel } from "@/components/summon/screen";
import { groupConversations, scopeFromConversation } from "./assistant-model";
import { SCOPE_ICONS } from "./assistant-composer";

interface AssistantConversationSidebarProps {
  conversations: ISummonAssistantConversation[];
  activeConversationId: string;
  loading: boolean;
  error: unknown;
  onNew: () => void;
  onRetry: () => void;
  onSelect: (conversation: ISummonAssistantConversation) => void;
}

/** Private chat history, newest first, grouped by when it was last active. */
export function AssistantConversationSidebar(props: AssistantConversationSidebarProps) {
  const groups = groupConversations(props.conversations, new Date());
  return (
    <SummonPanel
      title="Chats"
      flush
      className="max-h-72 lg:h-full lg:max-h-none"
      action={
        <Button size="sm" variant="secondary" onClick={props.onNew} aria-label="New chat">
          <SquarePen aria-hidden className="size-3.5" /> New
        </Button>
      }
    >
      <nav aria-label="Chats" className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <SummonRequestState
          loading={props.loading}
          error={props.error}
          empty={!props.loading && props.conversations.length === 0}
          emptyMessage="Your chats appear here. Only you can see them."
          onRetry={props.onRetry}
        />
        {groups.map((group) => (
          <section key={group.label} className="mt-2 first:mt-0">
            <h3 className="px-2 pt-1 pb-1 text-11 font-medium text-tertiary">{group.label}</h3>
            <ul className="space-y-0.5">
              {group.conversations.map((conversation) => {
                const active = conversation.id === props.activeConversationId;
                const { kind } = scopeFromConversation(conversation);
                const Icon = kind === "workspace" ? MessageSquareText : SCOPE_ICONS[kind];
                return (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      aria-current={active ? "page" : undefined}
                      onClick={() => props.onSelect(conversation)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-13 focus-visible:outline-2 focus-visible:outline-accent-strong focus-visible:outline-solid",
                        active
                          ? "bg-layer-1-selected font-medium text-primary"
                          : "text-secondary hover:bg-layer-1-hover hover:text-primary"
                      )}
                    >
                      <Icon aria-hidden className="size-3.5 flex-none text-tertiary" />
                      <span className="truncate" title={conversation.title}>
                        {conversation.title}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </nav>
    </SummonPanel>
  );
}
