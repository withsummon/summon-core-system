import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { ReactionPanel } from "./panel";
export function TaskReactions({ taskId }: { taskId: Id<"tasks"> }) {
  const access = useQuery(api.tasks.reactions.access, { taskId });
  const rows = usePaginatedQuery(api.tasks.reactions.list, { taskId }, { initialNumItems: 20 });
  const setReaction = useMutation(api.tasks.reactions.set);
  return (
    <ReactionPanel
      label="Task reactions"
      canReact={!!access?.canReact}
      rows={rows.results}
      status={rows.status}
      loadMore={rows.loadMore}
      onChange={(reaction, active) => setReaction({ taskId, reaction, active })}
    />
  );
}
export function CommentReactions({ taskId, commentId }: { taskId: Id<"tasks">; commentId: Id<"taskComments"> }) {
  const target = { taskId, commentId };
  const access = useQuery(api.tasks.commentReactions.access, target);
  const rows = usePaginatedQuery(api.tasks.commentReactions.list, target, { initialNumItems: 20 });
  const setReaction = useMutation(api.tasks.commentReactions.set);
  return (
    <ReactionPanel
      label="Comment reactions"
      canReact={!!access?.canReact}
      rows={rows.results}
      status={rows.status}
      loadMore={rows.loadMore}
      onChange={(reaction, active) => setReaction({ ...target, reaction, active })}
    />
  );
}
