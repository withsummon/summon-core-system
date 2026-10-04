import { Component, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { GlobeIcon, LockIcon } from "@plane/propel/icons";
import { TaskImageEditor } from "./image-editor";
export function FocusedComment({
  taskId,
  commentId,
  onClose,
}: {
  taskId: Id<"tasks">;
  commentId: string;
  onClose: () => void;
}) {
  return (
    <section aria-label="Notification comment" className="space-y-3 rounded-xl border border-accent-strong p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-16 font-medium">Notification comment</h4>
        <Button variant="secondary" onClick={onClose}>
          Close comment preview
        </Button>
      </header>
      <CommentBoundary key={commentId}>
        <CommentPreview taskId={taskId} commentId={commentId} />
      </CommentBoundary>
    </section>
  );
}
function CommentPreview({ taskId, commentId }: { taskId: Id<"tasks">; commentId: string }) {
  const comment = useQuery(api.tasks.comments.get, { taskId, commentId });
  const target = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (comment?._id) {
      target.current?.focus({ preventScroll: true });
      target.current?.scrollIntoView({ block: "start" });
    }
  }, [comment?._id]);
  if (!comment) return <p role="status">Opening comment…</p>;
  return (
    <div ref={target} tabIndex={-1} aria-label="Selected notification comment" className="space-y-3 outline-none">
      <p className="text-12 text-secondary">
        {comment.authorName ?? "Member"} · {new Date(comment._creationTime).toLocaleString()}
        {comment.editedAt ? " · Edited" : ""}
        <span className="ml-2 inline-flex items-center gap-1">
          {comment.audience === "INTERNAL" ? <LockIcon className="size-3" /> : <GlobeIcon className="size-3" />}
          {comment.audience === "INTERNAL" ? "Private" : "Public"}
        </span>
      </p>
      <TaskImageEditor
        target={{ comment: { taskId, commentId: comment._id, anchor: null } }}
        key={comment.updatedAt}
        id={`focused-comment-${comment._id}`}
        label="Notification comment content"
        placeholder=""
        html={comment.html}
        editable={false}
      />
    </div>
  );
}
class CommentBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="status" className="text-14 text-secondary">
        This comment is unavailable or has been deleted.
      </p>
    ) : (
      this.props.children
    );
  }
}
