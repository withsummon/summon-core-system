/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { LiteTextEditorWithRef } from "@plane/editor";
import type { EditorRefApi, ILiteTextEditorProps } from "@plane/editor";
import { cn } from "@plane/utils";
import { StickyEditorToolbar } from "./toolbar";

type Props = ILiteTextEditorProps & {
  parentClassName?: string;
  showToolbarInitially?: boolean;
  showToolbar?: boolean;
  handleDelete: () => void;
  handleColorChange: (data: { background_color?: string }) => Promise<void>;
};
export const StickyEditorView = React.forwardRef(function StickyEditorView(
  props: Props,
  ref: React.ForwardedRef<EditorRefApi>
) {
  const {
    containerClassName,
    parentClassName = "",
    showToolbarInitially = true,
    showToolbar = true,
    handleDelete,
    handleColorChange,
    handleEditorReady,
    ...rest
  } = props;
  const [, setReady] = useState(false);
  const [isFocused, setIsFocused] = useState(showToolbarInitially);
  const editorRef = ref && typeof ref === "object" ? ref.current : null;
  return (
    <div
      className={cn("relative rounded-sm border border-subtle", parentClassName)}
      onFocus={() => !showToolbarInitially && setIsFocused(true)}
      onBlur={() => !showToolbarInitially && setIsFocused(false)}
    >
      <LiteTextEditorWithRef
        ref={ref}
        containerClassName={cn(containerClassName, "relative")}
        {...rest}
        handleEditorReady={(ready) => {
          setReady(ready);
          handleEditorReady?.(ready);
        }}
      />
      {showToolbar && (
        <div
          className={cn("h-[60px] origin-top px-4 transition-all duration-300 ease-out", {
            "max-h-[60px] scale-y-100 opacity-100": isFocused,
            "invisible max-h-0 scale-y-0 opacity-0": !isFocused,
          })}
        >
          <StickyEditorToolbar
            executeCommand={(item) => {
              // TODO: update this while toolbar homogenization
              // @ts-expect-error type mismatch here
              editorRef?.executeMenuItemCommand({
                itemKey: item.itemKey,
                ...item.extraProps,
              });
            }}
            handleDelete={handleDelete}
            handleColorChange={handleColorChange}
            editorRef={editorRef}
          />
        </div>
      )}
    </div>
  );
});
