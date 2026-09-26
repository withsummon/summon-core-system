import { Component, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router";
import { usePaginatedQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { FunctionReturnType } from "convex/server";
import { Button } from "@plane/propel/button";
import { ConversationForm } from "./conversation-form";
import { Conversation } from "./conversation";
export function Assistant({ workspace }: { workspace: FunctionReturnType<typeof api.workspaces.index.list>[number] }) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.assistant.index.list,
    { workspaceId: workspace._id },
    { initialNumItems: 30 }
  );
  const [params, setParams] = useSearchParams();
  const selected = params.get("conversation");
  const [creating, setCreating] = useState(false);
  const canWrite = workspace.membershipRole !== "guest";
  const select = (id: string | null) => {
    setCreating(false);
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (id) next.set("conversation", id);
      else next.delete("conversation");
      return next;
    });
  };
  return (
    <section className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-secondary">{workspace.name}</p>
          <h1 className="text-2xl font-semibold">Summon Assistant</h1>
        </div>
        {canWrite && <Button onClick={() => setCreating(true)}>New conversation</Button>}
      </header>
      <div className="grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav
          aria-label="Conversations"
          className="max-h-64 overflow-y-auto border-b border-subtle-1 pb-4 lg:max-h-[65vh] lg:border-r lg:border-b-0 lg:pr-4"
        >
          <h2 className="text-xs mb-3 font-semibold text-secondary">RECENT CONVERSATIONS</h2>
          <div className="space-y-1">
            {results.map((conversation) => (
              <button
                className={`text-sm block w-full rounded-lg px-3 py-2 text-left break-words ${selected === conversation._id && !creating ? "bg-accent-subtle text-accent-primary" : "hover:bg-layer-1"}`}
                key={conversation._id}
                aria-current={selected === conversation._id && !creating ? "page" : undefined}
                onClick={() => select(conversation._id)}
              >
                {conversation.title}
              </button>
            ))}
          </div>
          {status === "LoadingFirstPage" && (
            <p role="status" className="text-sm">
              Loading conversations…
            </p>
          )}
          {status === "Exhausted" && !results.length && <p className="text-sm text-secondary">No conversations yet.</p>}
          {status === "CanLoadMore" && (
            <Button variant="secondary" onClick={() => loadMore(30)}>
              Load more conversations
            </Button>
          )}
        </nav>
        <div className="min-w-0">
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
                conversationId={selected}
                workspaceId={workspace._id}
                onRemoved={() => select(null)}
                canWrite={canWrite}
              />
            </ConversationBoundary>
          ) : (
            <div className="grid min-h-72 place-content-center text-center">
              <h2 className="text-xl font-medium">A conversation with your work</h2>
              <p className="text-sm mt-2 max-w-sm text-secondary">
                Select a conversation or start one with the sources you want to discuss.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
class ConversationBoundary extends Component<{ children: ReactNode; onBack: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">This conversation is unavailable</h2>
        <p role="alert" className="text-sm text-secondary">
          It may have been removed, or access to its sources may have changed.
        </p>
        <Button variant="secondary" onClick={this.props.onBack}>
          Back to conversations
        </Button>
      </section>
    );
  }
}
