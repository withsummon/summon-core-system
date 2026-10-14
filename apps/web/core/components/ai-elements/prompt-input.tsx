/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Adapted from AI Elements (https://elements.ai-sdk.dev/components/prompt-input) onto propel primitives.
import { forwardRef, useState } from "react";
import type { FormEventHandler, HTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { ArrowUp } from "lucide-react";
import { IconButton } from "@plane/propel/icon-button";
import { TextArea } from "@plane/propel/input";
import { cn } from "@plane/utils";

/**
 * The composer surface: one field-styled box holding attachments, the text area and a footer of tools.
 * Dropping files anywhere on it hands them to `onFiles`.
 */
export function PromptInput(props: {
  onSubmit: FormEventHandler<HTMLFormElement>;
  onFiles?: (files: File[]) => void;
  className?: string;
  children: ReactNode;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <form
      onSubmit={props.onSubmit}
      onDragOver={(event) => {
        if (!props.onFiles) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        if (!props.onFiles) return;
        event.preventDefault();
        setDragging(false);
        props.onFiles(Array.from(event.dataTransfer.files));
      }}
      className={cn(
        "flex w-full flex-col rounded-2xl border border-subtle bg-layer-2 shadow-raised-100 transition-[border-color,box-shadow] duration-150 focus-within:border-accent-strong focus-within:ring-[3px] focus-within:ring-accent-subtle motion-reduce:transition-none",
        dragging && "border-accent-strong ring-[3px] ring-accent-subtle",
        props.className
      )}
    >
      {props.children}
    </form>
  );
}

export function PromptInputHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-wrap gap-1.5 px-3 pt-3", className)} {...props} />;
}

/** Grows with its content up to a cap, then scrolls. */
export const PromptInputTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function PromptInputTextarea({ className, ...props }, ref) {
    return (
      <TextArea
        ref={ref}
        rows={1}
        className={cn(
          "[field-sizing:content] max-h-48 min-h-12 resize-none rounded-none border-0 bg-transparent px-4 pt-3.5 pb-1 text-14 shadow-none focus-visible:ring-0",
          className
        )}
        {...props}
      />
    );
  }
);

export function PromptInputFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-between gap-2 p-2", className)} {...props} />;
}

export function PromptInputTools({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex min-w-0 flex-1 flex-wrap items-center gap-1", className)} {...props} />;
}

export function PromptInputSubmit(props: { loading: boolean; disabled?: boolean }) {
  return (
    <IconButton
      type="submit"
      variant="primary"
      size="base"
      icon={ArrowUp}
      loading={props.loading}
      disabled={props.disabled}
      aria-label="Send message"
      className="flex-none rounded-full"
    />
  );
}
