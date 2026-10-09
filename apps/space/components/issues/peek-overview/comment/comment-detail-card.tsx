/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { MessageSquare, MoreVertical } from "lucide-react";
import { CustomMenu } from "@plane/ui";
import { CheckIcon, CloseIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { LiteTextEditor } from "@/components/editor/lite-text-editor";
import { CommentReactions } from "./comment-reactions";
import { timeAgo } from "@/helpers/date-time.helper";
import { useUser } from "@/hooks/store/use-user";
import useIsInIframe from "@/hooks/use-is-in-iframe";

export function CommentCard({
  anchor,
  comment,
}: {
  anchor: string;
  comment: FunctionReturnType<typeof api.tasks.comments.publicList>["page"][number];
}) {
  const { profile: currentUser } = useUser();
  const isInIframe = useIsInIframe();
  const [edit, setEdit] = useState<Pick<typeof comment, "html" | "updatedAt"> | null>(null);
  const [pending, setPending] = useState(false);
  const update = useMutation(api.tasks.comments.publicUpdate);
  const remove = useMutation(api.tasks.comments.publicRemove);
  const canEdit = !isInIframe && currentUser?.id === comment.authorId;
  const target = { anchor, taskId: comment.taskId, commentId: comment._id };
  const save = async () => {
    if (!edit || pending || !canEdit) return;
    setPending(true);
    try {
      await update({ ...target, expectedUpdatedAt: edit.updatedAt, html: edit.html });
      setEdit(null);
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Comment could not be saved",
        message: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setPending(false);
    }
  };
  const deleteComment = async () => {
    if (pending || !canEdit) return;
    setPending(true);
    try {
      await remove({ ...target, expectedUpdatedAt: comment.updatedAt });
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Comment could not be removed",
        message: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setPending(false);
    }
  };
  const avatar = comment.authorAvatar;
  const site = import.meta.env.VITE_CONVEX_SITE_URL;
  return (
    <div className="relative flex items-start space-x-3">
      <div className="relative px-1">
        {avatar && site ? (
          <img
            src={new URL(avatar.downloadPath, site).toString()}
            alt={comment.authorName ?? "Comment author"}
            height={30}
            width={30}
            className="grid size-7 place-items-center rounded-full border-2 border-strong-1"
          />
        ) : (
          <div className="bg-gray-500 grid size-7 place-items-center rounded-full border-2 border-strong-1 text-on-color">
            {comment.authorName?.charAt(0)}
          </div>
        )}
        <span className="absolute -right-1 -bottom-0.5 rounded-tl-sm bg-layer-1 px-0.5 py-px">
          <MessageSquare className="size-3 text-secondary" aria-hidden strokeWidth={2} />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-11">{comment.authorName}</div>
        <p className="mt-0.5 text-11 text-secondary">
          commented {timeAgo(new Date(comment._creationTime).toISOString())}
        </p>
        <div className="issue-comments-section p-0">
          {edit ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
              className="flex flex-col gap-2"
            >
              <fieldset disabled={pending || !canEdit}>
                <LiteTextEditor
                  editable={!pending && canEdit}
                  anchor={anchor}
                  target={{ comment: target }}
                  id={comment._id}
                  initialValue={edit.html}
                  onChange={(_json, html) => setEdit((current) => (current ? { ...current, html } : null))}
                  onEnterKeyPress={(event) => {
                    event.preventDefault();
                    void save();
                  }}
                  isSubmitting={pending}
                  showSubmitButton={false}
                  displayConfig={{ fontSize: "small-font" }}
                />
                <button
                  type="submit"
                  aria-label="Save comment"
                  className="group shadow-md rounded-sm border border-success-strong bg-success-primary p-2"
                >
                  <CheckIcon className="size-3 text-on-color" strokeWidth={2} />
                </button>
              </fieldset>
              <button
                type="button"
                disabled={pending}
                aria-label="Discard comment edits"
                className="group shadow-md self-end rounded-sm border border-danger-strong bg-danger-primary p-2"
                onClick={() => setEdit(null)}
              >
                <CloseIcon className="size-3 text-on-color" strokeWidth={2} />
              </button>
            </form>
          ) : (
            <>
              <LiteTextEditor
                key={comment.updatedAt}
                editable={false}
                anchor={anchor}
                target={{ comment: target }}
                id={comment._id}
                initialValue={comment.html}
                displayConfig={{ fontSize: "small-font" }}
              />
              <CommentReactions {...target} />
            </>
          )}
        </div>
      </div>
      {canEdit && (
        <CustomMenu
          ariaLabel="Comment actions"
          customButton={<MoreVertical className="size-4" />}
          noChevron
          placement="bottom-end"
          disabled={pending}
        >
          <CustomMenu.MenuItem onClick={() => setEdit({ html: comment.html, updatedAt: comment.updatedAt })}>
            Edit
          </CustomMenu.MenuItem>
          <CustomMenu.MenuItem onClick={deleteComment}>Delete</CustomMenu.MenuItem>
        </CustomMenu>
      )}
    </div>
  );
}
