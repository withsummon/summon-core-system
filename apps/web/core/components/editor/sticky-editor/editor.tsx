/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
// plane constants
import type { EIssueCommentAccessSpecifier } from "@plane/constants";
// plane editor
import type { EditorRefApi, ILiteTextEditorProps, TFileHandler } from "@plane/editor";
// components
import type { TSticky } from "@plane/types";
// helpers
// hooks
import { useEditorConfig } from "@/hooks/editor";
import { useParseEditorContent } from "@/hooks/use-parse-editor-content";
// plane web hooks
import { useEditorFlagging } from "@/hooks/use-editor-flagging";
import { StickyEditorView } from "./view";

interface StickyEditorWrapperProps extends Omit<
  Omit<ILiteTextEditorProps, "extendedEditorProps">,
  "disabledExtensions" | "editable" | "flaggedExtensions" | "fileHandler" | "mentionHandler" | "getEditorMetaData"
> {
  workspaceSlug: string;
  workspaceId: string;
  projectId?: string;
  accessSpecifier?: EIssueCommentAccessSpecifier;
  handleAccessChange?: (accessKey: EIssueCommentAccessSpecifier) => void;
  showAccessSpecifier?: boolean;
  showSubmitButton?: boolean;
  isSubmitting?: boolean;
  showToolbarInitially?: boolean;
  showToolbar?: boolean;
  uploadFile: TFileHandler["upload"];
  duplicateFile: TFileHandler["duplicate"];
  parentClassName?: string;
  handleColorChange: (data: Partial<TSticky>) => Promise<void>;
  handleDelete: () => void;
}

export const StickyEditor = React.forwardRef(function StickyEditor(
  props: StickyEditorWrapperProps,
  ref: React.ForwardedRef<EditorRefApi>
) {
  const {
    containerClassName,
    workspaceSlug,
    workspaceId,
    projectId,
    handleDelete,
    handleColorChange,
    showToolbarInitially = true,
    showToolbar = true,
    parentClassName = "",
    uploadFile,
    duplicateFile,
    ...rest
  } = props;
  // states
  // editor flaggings
  const { liteText: liteTextEditorExtensions } = useEditorFlagging({
    workspaceSlug,
    projectId,
  });
  // parse content
  const { getEditorMetaData } = useParseEditorContent({
    projectId,
    workspaceSlug,
  });
  // editor config
  const { getEditorFileHandlers } = useEditorConfig();

  return (
    <StickyEditorView
      ref={ref}
      disabledExtensions={[...liteTextEditorExtensions.disabled, "enter-key"]}
      flaggedExtensions={liteTextEditorExtensions.flagged}
      editable
      fileHandler={getEditorFileHandlers({ projectId, uploadFile, duplicateFile, workspaceId, workspaceSlug })}
      getEditorMetaData={getEditorMetaData}
      mentionHandler={{ renderComponent: () => <></> }}
      extendedEditorProps={{}}
      containerClassName={containerClassName}
      parentClassName={parentClassName}
      showToolbar={showToolbar}
      showToolbarInitially={showToolbarInitially}
      handleDelete={handleDelete}
      handleColorChange={handleColorChange}
      {...rest}
    />
  );
});
StickyEditor.displayName = "StickyEditor";
