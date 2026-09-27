import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { EmojiReactionPicker } from "@plane/propel/emoji-reaction";
import { stringToEmoji } from "@plane/propel/emoji-icon-picker";
import { mutationMessage } from "../../commercial/forms";
export function TaskReactions({ taskId }: { taskId: Id<"tasks"> }) {
  const access = useQuery(api.tasks.reactions.access, { taskId });
  const rows = usePaginatedQuery(api.tasks.reactions.list, { taskId }, { initialNumItems: 20 });
  const setReaction = useMutation(api.tasks.reactions.set);
  const [open, setOpen] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function change(reaction: string, active: boolean) {
    setPending(true);
    setError("");
    try {
      await setReaction({ taskId, reaction, active });
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  }
  return (
    <section aria-label="Task reactions" className="space-y-3 border-t border-subtle-1 pt-4">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-16 font-semibold">Reactions</h3>
        {access?.canReact && (
          <EmojiReactionPicker
            isOpen={open}
            handleToggle={setOpen}
            onChange={(reaction) => void change(reaction, true)}
            disabled={pending}
            label={<span className="text-14 text-accent-primary">Add reaction</span>}
          />
        )}
      </header>
      <ul className="flex flex-wrap gap-2">
        {rows.results.map((row) => (
          <li key={row._id} className="flex items-center gap-2 rounded-md border border-subtle-1 px-3 py-2 text-14">
            <span>{stringToEmoji(row.reaction)}</span>
            <span>{row.isMine ? "You" : row.actorName || `Member …${row.actorId.slice(-6)}`}</span>
            {row.isMine && access?.canReact && (
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                aria-label={`Remove your ${stringToEmoji(row.reaction)} reaction`}
                onClick={() => void change(row.reaction, false)}
              >
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>
      {rows.status === "LoadingFirstPage" && <p role="status">Loading reactions…</p>}
      {rows.status === "Exhausted" && !rows.results.length && (
        <p className="text-14 text-secondary">No reactions yet.</p>
      )}
      {rows.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => rows.loadMore(20)}>
          Load more reactions
        </Button>
      )}
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </section>
  );
}
