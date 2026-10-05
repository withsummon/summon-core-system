/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
import type { EditorRefApi } from "@plane/editor";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { isCommentEmpty } from "@plane/utils";
import { LiteTextEditor } from "@/components/editor/lite-text-editor";

export function AddComment({
  anchor,
  taskId,
}: Omit<FunctionArgs<typeof api.tasks.comments.publicCreate>, "requestId" | "html">) {
  const [html, setHtml] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const editor = useRef<EditorRefApi>(null);
  const create = useMutation(api.tasks.comments.publicCreate);
  const submit = async () => {
    if (pending || isCommentEmpty(html)) return;
    setPending(true);
    try {
      await create({ anchor, taskId, requestId, html });
      setHtml("");
      editor.current?.clearEditor();
      setRequestId(crypto.randomUUID());
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Comment could not be posted",
        message: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setPending(false);
    }
  };
  return (
    <fieldset disabled={pending} className="issue-comments-section">
      <LiteTextEditor
        key={requestId}
        editable={!pending}
        anchor={anchor}
        ref={editor}
        id={requestId}
        target={{ comment: { anchor, taskId, requestId } }}
        initialValue={html}
        onChange={(_json, content) => setHtml(content)}
        onEnterKeyPress={(event) => {
          event.preventDefault();
          void submit();
        }}
        isSubmitting={pending}
        placeholder="Add comment..."
        displayConfig={{ fontSize: "small-font" }}
      />
    </fieldset>
  );
}
