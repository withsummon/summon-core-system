import { CommentReactions } from "./reactions/reactions";
import { useSearchParams } from "react-router";
import { CommentMentions } from "./comment-mentions";
import { FocusedComment } from "./focused-comment";
import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { GlobeIcon, LockIcon } from "@plane/propel/icons";
import { CustomMenu } from "@plane/ui";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { mutationMessage } from "../commercial/forms";
import { TaskRichEditor } from "./rich-editor";
type Comment = FunctionReturnType<typeof api.tasks.comments.list>["page"][number];
export function TaskComments({ taskId }: { taskId: Id<"tasks"> }) {
  const [params, setParams] = useSearchParams();
  const focused = params.get("comment");
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
      {focused && (
        <FocusedComment
          taskId={taskId}
          commentId={focused}
          onClose={() =>
            setParams((current) => {
              const next = new URLSearchParams(current);
              next.delete("comment");
              return next;
            })
          }
        />
      )}
      {composing && (
        <CommentForm taskId={taskId} canEdit={access?.canCreate === true} onDone={() => setComposing(false)} />
      )}
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
  const update = useMutation(api.tasks.comments.update);
  const remove = useMutation(api.tasks.comments.remove);
  const restore = useMutation(api.tasks.comments.restore);
  const [editing, setEditing] = useState(false);
  const [deleteRevision, setDeleteRevision] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useReloadConfirmations(pending, "A comment command is still running.", undefined, pending);
  return (
    <li className="space-y-3 rounded-xl border border-subtle-1 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-12 text-secondary">
          <span className="font-medium text-primary">{comment.authorName || "Member"}</span> ·{" "}
          {new Date(comment._creationTime).toLocaleString()}
          {comment.editedAt ? " · Edited" : ""}
          <span className="ml-2 inline-flex items-center gap-1">
            {comment.audience === "INTERNAL" ? <LockIcon className="size-3" /> : <GlobeIcon className="size-3" />}
            {comment.audience === "INTERNAL" ? "Private" : "Public"}
          </span>
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
          <CustomMenu placement="bottom-end" ellipsis closeOnSelect disabled={pending} ariaLabel="Comment actions">
            <CustomMenu.MenuItem onClick={() => setEditing(true)}>Edit comment</CustomMenu.MenuItem>
            <CustomMenu.MenuItem
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  await update({
                    commentId: comment._id,
                    expectedUpdatedAt: comment.updatedAt,
                    audience: comment.audience === "INTERNAL" ? "EXTERNAL" : "INTERNAL",
                  });
                } catch (failure) {
                  setError(mutationMessage(failure));
                } finally {
                  setPending(false);
                }
              }}
            >
              {comment.audience === "INTERNAL" ? "Switch to public" : "Switch to private"}
            </CustomMenu.MenuItem>
            <CustomMenu.MenuItem
              onClick={() => {
                setError("");
                setDeleteRevision(comment.updatedAt);
              }}
            >
              Delete comment
            </CustomMenu.MenuItem>
          </CustomMenu>
        )}
      </header>
      {editing ? (
        <CommentForm
          taskId={comment.taskId}
          comment={comment}
          canEdit={comment.canEdit}
          onDone={() => setEditing(false)}
        />
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
      {comment.deletedAt == null && <CommentReactions taskId={comment.taskId} commentId={comment._id} />}
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
function CommentForm({
  taskId,
  comment,
  canEdit,
  onDone,
}: {
  taskId: Id<"tasks">;
  comment?: Comment;
  canEdit: boolean;
  onDone: () => void;
}) {
  const create = useMutation(api.tasks.comments.create);
  const update = useMutation(api.tasks.comments.update);
  // Capture the revision with the draft. Reactive remote edits must not bless a stale draft.
  const [initial] = useState(comment);
  const [html, setHtml] = useState(comment?.html ?? "<p></p>");
  const [mentionedUserIds, setMentionedUserIds] = useState(comment?.mentionedUserIds ?? []);
  const [audience, setAudience] = useState<FunctionArgs<typeof api.tasks.comments.create>["audience"]>(
    comment?.audience ?? "INTERNAL"
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const changed = initial !== undefined && comment?.updatedAt !== initial.updatedAt;
  const initialMentions = initial?.mentionedUserIds ?? [];
  const dirty =
    html !== (initial?.html ?? "<p></p>") ||
    audience !== (initial?.audience ?? "INTERNAL") ||
    mentionedUserIds.length !== initialMentions.length ||
    mentionedUserIds.some((id) => !initialMentions.includes(id));
  const release = useReloadConfirmations(dirty || pending, "This comment has unsaved changes.", onDone, pending);
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending || !canEdit) return;
        setPending(true);
        setError("");
        try {
          if (initial)
            await update({
              commentId: initial._id,
              expectedUpdatedAt: initial.updatedAt,
              html,
              mentionedUserIds,
              audience,
            });
          else await create({ taskId, html, mentionedUserIds, audience });
          release(onDone);
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
        html={html}
        editable={!pending && canEdit}
        onChange={setHtml}
      />
      {!canEdit && (
        <p role="status" className="text-14 text-secondary">
          You can no longer change this comment. Your draft is preserved; copy it before cancelling.
        </p>
      )}
      <CommentMentions
        taskId={taskId}
        selected={mentionedUserIds}
        onChange={setMentionedUserIds}
        disabled={pending || !canEdit}
      />
      <div role="group" aria-label="Comment audience" className="flex gap-2">
        <Button
          variant="secondary"
          prependIcon={<LockIcon />}
          aria-pressed={audience === "INTERNAL"}
          disabled={pending || !canEdit}
          onClick={() => setAudience("INTERNAL")}
        >
          Private
        </Button>
        <Button
          variant="secondary"
          prependIcon={<GlobeIcon />}
          aria-pressed={audience === "EXTERNAL"}
          disabled={pending || !canEdit}
          onClick={() => setAudience("EXTERNAL")}
        >
          Public
        </Button>
      </div>
      <div className="flex gap-2">
        <Button type="submit" loading={pending} disabled={!canEdit}>
          {initial ? "Save comment" : "Post comment"}
        </Button>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => {
            release();
            onDone();
          }}
        >
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
