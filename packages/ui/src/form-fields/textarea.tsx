/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useRef } from "react";
// helpers
import { useAutoResizeTextArea } from "../hooks/use-auto-resize-textarea";
import { FIELD_CLASSNAME } from "@plane/propel/input";
import { cn } from "../utils";
// hooks

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  mode?: "primary" | "transparent" | "true-transparent";
  textAreaSize?: "xs" | "sm" | "md";
  hasError?: boolean;
  className?: string;
}

const TextArea = React.forwardRef(function TextArea(
  props: TextAreaProps,
  ref: React.ForwardedRef<HTMLTextAreaElement>
) {
  const {
    id,
    name,
    value = "",
    mode = "primary",
    textAreaSize = "sm",
    hasError = false,
    className = "",
    ...rest
  } = props;
  // refs
  const textAreaRef = useRef<any>(ref);
  // auto re-size
  useAutoResizeTextArea(textAreaRef, value);

  return (
    <textarea
      id={id}
      name={name}
      ref={textAreaRef}
      value={value}
      className={cn(
        "no-scrollbar w-full bg-layer-2 text-13 placeholder-(--text-color-placeholder) outline-none",
        {
          [FIELD_CLASSNAME]: mode === "primary",
          "focus-visible:ring-theme rounded-sm border-none bg-transparent ring-0 transition-shadow focus-visible:ring-1":
            mode === "transparent",
          "rounded-sm border-none bg-transparent ring-0": mode === "true-transparent",
          "px-1.5 py-1": textAreaSize === "xs",
          "px-3 py-2": textAreaSize === "sm",
          "p-3": textAreaSize === "md",
          "border-danger-strong": hasError,
          "bg-danger-subtle": hasError && mode === "primary",
        },
        className
      )}
      {...rest}
    />
  );
});

TextArea.displayName = "TextArea";

export { TextArea };
