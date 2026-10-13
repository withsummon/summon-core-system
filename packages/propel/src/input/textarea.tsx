/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";
import { cn } from "../utils";
import { FIELD_CLASSNAME } from "./field";

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

/** Multi-line field with the same look as `Input`. */
const TextArea = React.forwardRef(function TextArea(
  { className, hasError = false, rows = 3, ...rest }: TextAreaProps,
  ref: React.ForwardedRef<HTMLTextAreaElement>
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(FIELD_CLASSNAME, "block w-full px-3 py-2", hasError && "border-danger-strong", className)}
      aria-invalid={hasError || undefined}
      {...rest}
    />
  );
});

TextArea.displayName = "form-textarea-field";

export { TextArea };
