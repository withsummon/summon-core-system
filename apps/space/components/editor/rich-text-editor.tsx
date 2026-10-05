/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { forwardRef } from "react";
// plane imports
import { RichTextEditorWithRef } from "@plane/editor";
import type { EditorRefApi, IRichTextEditorProps } from "@plane/editor";
import type { MakeOptional } from "@plane/types";
// helpers
import type { EditorTarget } from "@/helpers/editor.helper";
import { useEditorFileHandlers } from "@/helpers/editor.helper";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useParseEditorContent } from "@/hooks/use-parse-editor-content";
// plane web imports
import { useEditorFlagging } from "@/hooks/use-editor-flagging";
// local imports
import { EditorMentionsRoot } from "./embeds/mentions";

type RichTextEditorWrapperProps = MakeOptional<
  Omit<IRichTextEditorProps, "editable" | "fileHandler" | "mentionHandler" | "extendedEditorProps">,
  "disabledExtensions" | "flaggedExtensions" | "getEditorMetaData"
> & {
  anchor: string;
  target: EditorTarget;
  editable: boolean;
};

export const RichTextEditor = forwardRef(function RichTextEditor(
  props: RichTextEditorWrapperProps,
  ref: React.ForwardedRef<EditorRefApi>
) {
  const {
    anchor,
    containerClassName,
    editable,
    target,
    disabledExtensions: additionalDisabledExtensions = [],
    ...rest
  } = props;
  // store hooks
  const { results } = useMember();
  // parse content
  const { getEditorMetaData } = useParseEditorContent({
    target,
  });
  // editor flaggings
  const { richText: richTextEditorExtensions } = useEditorFlagging(anchor);

  const fileHandler = useEditorFileHandlers(target);
  if (!fileHandler) return <p role="status">Loading editor…</p>;
  return (
    <RichTextEditorWithRef
      mentionHandler={{
        renderComponent: (mentionProps) => <EditorMentionsRoot {...mentionProps} />,
        getMentionedEntityDetails: (id: string) => ({
          display_name: results.find((member) => member.userId === id)?.name ?? "",
        }),
      }}
      ref={ref}
      disabledExtensions={[...richTextEditorExtensions.disabled, ...additionalDisabledExtensions]}
      editable={editable}
      fileHandler={fileHandler}
      getEditorMetaData={getEditorMetaData}
      flaggedExtensions={richTextEditorExtensions.flagged}
      extendedEditorProps={{}}
      {...rest}
      containerClassName={containerClassName}
      editorClassName="min-h-[100px] py-2 overflow-hidden"
      displayConfig={{ fontSize: "large-font" }}
    />
  );
});

RichTextEditor.displayName = "RichTextEditor";
