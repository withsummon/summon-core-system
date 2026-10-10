/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";
import { Input as BaseInput } from "@base-ui/react/input";
// helpers
import { cn } from "../utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  mode?: "primary" | "transparent" | "true-transparent";
  inputSize?: "xs" | "sm" | "md";
  hasError?: boolean;
}

const Input = React.forwardRef(function Input(props: InputProps, ref: React.ForwardedRef<HTMLInputElement>) {
  const {
    id,
    type,
    name,
    mode = "primary",
    inputSize = "sm",
    hasError = false,
    className = "",
    autoComplete = "off",
    ...rest
  } = props;

  return (
    <BaseInput
      id={id}
      ref={ref}
      type={type}
      name={name}
      className={cn(
        "block rounded-lg border-subtle bg-layer-2 text-13 text-primary transition-[border-color,box-shadow] duration-150 placeholder:text-placeholder focus-visible:border-accent-strong focus-visible:ring-[3px] focus-visible:ring-accent-subtle focus-visible:outline-none",
        {
          "border shadow-raised-100": mode === "primary",
          "rounded-sm border-none bg-transparent ring-0 transition-all focus:ring-1 focus:ring-accent-strong":
            mode === "transparent",
          "rounded-sm border-none bg-transparent ring-0": mode === "true-transparent",
          "border-danger-strong": hasError,
          "px-1.5 py-1": inputSize === "xs",
          "px-3 py-2": inputSize === "sm",
          "p-3": inputSize === "md",
        },
        className
      )}
      aria-invalid={hasError || undefined}
      autoComplete={autoComplete}
      {...rest}
    />
  );
});

Input.displayName = "form-input-field";

export { Input };
