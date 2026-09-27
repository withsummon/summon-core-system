import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { mutationMessage } from "../commercial/forms";
import { TaskRichEditor } from "./rich-editor";
type Comment = FunctionReturnType<typeof api.tasks.comments.list>["page"][number];
export function TaskComments({ taskId }: { taskId: Id<"tasks"> }) {
  const [deleted, setDeleted] = useState(false);
  const access = useQuery(api.tasks.comments.access, { taskId });
  const { results, status, loadMore } = usePaginatedQuery(api.tasks.comments.list, { taskId }, { initialNumItems: 10 });
  const [composing, setComposing] = useState(false);
  return (
    <section className="space-y-4 border-t border-subtle-1 pt-5">
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-16 font-medium">Comments</h3>
        {access?.canCreate && !composing && (
          <Button variant="secondary" onClick={() => setComposing(true)}>
            Add comment
          </Button>
        )}
      </header>
      {composing && access?.canCreate && <CommentForm taskId={taskId} onDone={() => setComposing(false)} />}
      <ul className="space-y-4">
        {results.map((comment) => (
          <CommentRow key={comment._id} comment={comment} />
        ))}
      </ul>
      {(status === "LoadingFirstPage" || status === "LoadingMore") && <p role="status">Loading comments…</p>}
      {status === "Exhausted" && results.length === 0 && <p className="text-14 text-secondary">No comments yet.</p>}
      {status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => loadMore(10)}>
          Load older comments
        </Button>
      )}
      <Button variant="secondary" aria-expanded={deleted} onClick={() => setDeleted(!deleted)}>
        {deleted ? "Hide deleted comments" : "Show deleted comments"}
      </Button>
      {deleted && <DeletedComments taskId={taskId} />}
    </section>
  );
}
function DeletedComments({ taskId }: { taskId: Id<"tasks"> }) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.tasks.comments.list,
    { taskId, deleted: true },
    { initialNumItems: 10 }
  );
  return (
    <section aria-label="Deleted comments" className="space-y-4 border-t border-subtle-1 pt-4">
      <h4 className="text-14 font-medium">Deleted comments</h4>
      <p className="text-12 text-secondary">
        You can restore comments you wrote or moderate as a project administrator.
      </p>
      <ul className="space-y-4">
        {results.map((comment) => (
          <CommentRow key={comment._id} comment={comment} />
        ))}
      </ul>
      {(status === "LoadingFirstPage" || status === "LoadingMore") && <p role="status">Loading deleted comments…</p>}
      {status === "Exhausted" && !results.length && (
        <p className="text-14 text-secondary">No deleted comments available to restore.</p>
      )}
      {status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => loadMore(10)}>
          Load more deleted comments
        </Button>
      )}
    </section>
  );
}
function CommentRow({ comment }: { comment: Comment }) {
  const remove = useMutation(api.tasks.comments.remove);
  const restore = useMutation(api.tasks.comments.restore);
  const [editing, setEditing] = useState(false);
  const [deleteRevision, setDeleteRevision] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <li className="space-y-3 rounded-xl border border-subtle-1 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-12 text-secondary">
          <span className="font-medium text-primary">{comment.authorName || "Member"}</span> ·{" "}
          {new Date(comment._creationTime).toLocaleString()}
          {comment.editedAt ? " · Edited" : ""}
        </p>
        {comment.canRestore && (
          <Button
            variant="secondary"
            loading={pending}
            onClick={async () => {
              setPending(true);
              setError("");
              try {
                await restore({ commentId: comment._id, expectedUpdatedAt: comment.updatedAt });
              } catch (failure) {
                setError(mutationMessage(failure));
              } finally {
                setPending(false);
              }
            }}
          >
            Restore comment
          </Button>
        )}
        {comment.canEdit && !editing && deleteRevision === null && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit comment
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setError("");
                setDeleteRevision(comment.updatedAt);
              }}
            >
              Delete comment
            </Button>
          </div>
        )}
      </header>
      {editing && comment.canEdit ? (
        <CommentForm taskId={comment.taskId} comment={comment} onDone={() => setEditing(false)} />
      ) : (
        <TaskRichEditor
          key={comment.updatedAt}
          id={`comment-${comment._id}`}
          label="Comment"
          placeholder=""
          html={comment.html}
          editable={false}
        />
      )}
      {deleteRevision !== null && comment.canEdit && (
        <div className="space-y-2" role="group" aria-label="Confirm comment deletion">
          <p className="text-14">
            Move this comment to deleted comments? You or a project administrator can restore it.
          </p>
          <div className="flex gap-2">
            <Button
              variant="primary"
              loading={pending}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  await remove({ commentId: comment._id, expectedUpdatedAt: deleteRevision });
                } catch (failure) {
                  setError(mutationMessage(failure));
                } finally {
                  setPending(false);
                }
              }}
            >
              Move to deleted comments
            </Button>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setDeleteRevision(null);
                setError("");
              }}
            >
              Keep comment
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </li>
  );
}
function CommentForm({ taskId, comment, onDone }: { taskId: Id<"tasks">; comment?: Comment; onDone: () => void }) {
  const create = useMutation(api.tasks.comments.create);
  const update = useMutation(api.tasks.comments.update);
  // Capture the revision with the draft. Reactive remote edits must not bless a stale draft.
  const [initial] = useState(comment);
  const [html, setHtml] = useState(comment?.html ?? "<p></p>");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const changed = initial !== undefined && comment?.updatedAt !== initial.updatedAt;
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        try {
          if (initial) await update({ commentId: initial._id, expectedUpdatedAt: initial.updatedAt, html });
          else await create({ taskId, html });
          onDone();
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      {changed && (
        <p role="status" className="text-14 text-secondary">
          This comment changed while you were editing. Your draft is preserved; copy it before cancelling to reopen the
          latest comment.
        </p>
      )}
      <TaskRichEditor
        id={`comment-draft-${initial?._id ?? taskId}`}
        label={initial ? "Edit comment" : "New comment"}
        placeholder="Write a comment…"
        html={initial?.html ?? "<p></p>"}
        editable={!pending}
        onChange={setHtml}
      />
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          {initial ? "Save comment" : "Post comment"}
        </Button>
        <Button variant="secondary" disabled={pending} onClick={onDone}>
          Cancel
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </form>
  );
}
