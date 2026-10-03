import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
export function CommentMentions({
  taskId,
  selected,
  onChange,
  disabled,
}: {
  taskId: Id<"tasks">;
  selected: Id<"users">[];
  onChange: (ids: Id<"users">[]) => void;
  disabled: boolean;
}) {
  const policy = useQuery(api.notifications.mentions.policy, {});
  const people = usePaginatedQuery(api.notifications.mentions.choices, { taskId }, { initialNumItems: 30 });
  const choices = [
    ...people.results,
    ...selected
      .filter((id) => !people.results.some((person) => person.id === id))
      .map((id) => ({ id, name: `Selected member …${id.slice(-6)} (unavailable or not loaded)`, email: null })),
  ];
  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="text-14 font-medium">Mention people</legend>
      <p className="text-12 text-secondary">
        Choose people to notify with this comment. Mentions are saved alongside the comment text.
      </p>
      {policy && (
        <p className="text-12 text-secondary">
          {selected.length} of {policy.maxRecipients} people selected
        </p>
      )}
      <div className="flex max-h-48 flex-wrap gap-x-4 gap-y-2 overflow-y-auto">
        {choices.map((person) => (
          <label key={person.id} className="flex min-w-0 items-center gap-2 text-14">
            <input
              type="checkbox"
              checked={selected.includes(person.id)}
              disabled={!selected.includes(person.id) && (!policy || selected.length >= policy.maxRecipients)}
              onChange={(event) =>
                onChange(event.target.checked ? [...selected, person.id] : selected.filter((id) => id !== person.id))
              }
            />
            <span className="break-words">{person.name || person.email || `Member …${person.id.slice(-6)}`}</span>
          </label>
        ))}
      </div>
      {people.status === "LoadingFirstPage" && <p role="status">Loading mention choices…</p>}
      {people.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => people.loadMore(30)}>
          Load more mention choices
        </Button>
      )}
    </fieldset>
  );
}
