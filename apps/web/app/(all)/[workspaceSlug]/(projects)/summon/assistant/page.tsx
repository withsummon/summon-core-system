import { PageHead } from "@/components/core/page-title";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useOutletContext, useSearchParams } from "react-router";
import { usePaginatedQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { SummonScreen, SummonCard } from "@/components/summon/screen";
import { Conversation, ConversationBoundary } from "@/components/convex-core/assistant/conversation";
import { ConversationForm } from "@/components/convex-core/assistant/conversation-form";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import { AssistantConversationSidebar } from "./conversation-sidebar";
export default function SummonAssistantPage() {
  const session = useOutletContext<WorkspaceSession>();
  const { workspace } = session;
  const commands = useStickiesCommands();
  const list = usePaginatedQuery(api.assistant.index.list, { workspaceId: workspace._id }, { initialNumItems: 30 });
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const selected = params.get("conversation") ?? list.results[0]?._id;
  const select = (id: string | null) => {
    setCreating(false);
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (id) next.set("conversation", id);
      else next.delete("conversation");
      return next;
    });
  };
  const canWrite = workspace.membershipRole !== "guest";
  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
      <PageHead title="Assistant · Summon Core" />
      <SummonScreen
        title="Summon Assistant"
        description="Chat with authorized Summon project, document, meeting, and client knowledge."
      >
        <div className="grid min-h-0 gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <AssistantConversationSidebar
            conversations={list.results}
            activeConversationId={selected ?? ""}
            loading={list.status === "LoadingFirstPage"}
            creating={creating}
            canCreate={canWrite}
            onCreate={() => setCreating(true)}
            onSelect={(row) => select(row._id)}
            canLoadMore={list.status === "CanLoadMore"}
            onLoadMore={() => list.loadMore(30)}
          />
          <SummonCard className="flex min-h-[36rem] flex-col overflow-y-auto p-4 lg:h-[calc(100dvh-10.5rem)]">
            {creating && canWrite ? (
              <ConversationForm
                workspaceId={workspace._id}
                conversation={null}
                onDone={select}
                onCancel={() => setCreating(false)}
              />
            ) : selected ? (
              <ConversationBoundary key={selected} onBack={() => select(null)}>
                <Conversation
                  workspaceSlug={workspace.slug}
                  conversationId={selected}
                  workspaceId={workspace._id}
                  onRemoved={() => select(null)}
                  canWrite={canWrite}
                />
              </ConversationBoundary>
            ) : (
              <div className="grid flex-1 place-content-center text-center">
                <h2 className="text-xl font-semibold">What can I help you with?</h2>
                <p className="text-sm mt-2 text-secondary">Start a chat and choose the sources you want to discuss.</p>
              </div>
            )}
          </SummonCard>
        </div>
      </SummonScreen>
    </PreservedWorkspaceShell>
  );
}
