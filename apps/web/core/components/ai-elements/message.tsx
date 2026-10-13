/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Adapted from AI Elements (https://elements.ai-sdk.dev/components/message) onto propel primitives.
import type { HTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@plane/propel/button";
import { Tooltip } from "@plane/propel/tooltip";
import { cn } from "@plane/utils";
import { MarkdownRenderer } from "@/components/ui/markdown-to-component";

type TRole = "user" | "assistant";

/** One turn. The user's turn sits right in a quiet bubble; the answer reads as full-width prose. */
export function Message({ from, className, ...props }: HTMLAttributes<HTMLElement> & { from: TRole }) {
  return (
    <article
      data-role={from}
      className={cn("group flex w-full min-w-0 flex-col gap-2", from === "user" && "items-end", className)}
      {...props}
    />
  );
}

export function MessageContent({ from, className, ...props }: HTMLAttributes<HTMLDivElement> & { from: TRole }) {
  return (
    <div
      className={cn(
        "min-w-0 text-14 text-primary",
        from === "user"
          ? "max-w-[85%] rounded-2xl bg-layer-2 px-4 py-2.5 break-words whitespace-pre-wrap"
          : "w-full leading-relaxed",
        className
      )}
      {...props}
    />
  );
}

/** Rendered answer text. */
export function MessageResponse({ markdown }: { markdown: string }) {
  return (
    <div className="prose-sm dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-18 prose-h2:text-16 prose-h3:text-14 prose-p:leading-relaxed prose-code:rounded prose-code:bg-layer-2 prose-code:px-1 prose-code:py-0.5 prose-code:text-12 prose-code:font-medium prose-code:before:content-none prose-code:after:content-none max-w-none text-14 prose">
      <MarkdownRenderer markdown={markdown} />
    </div>
  );
}

export function MessageActions({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("-ml-2 flex flex-wrap items-center gap-0.5", className)} {...props} />;
}

/** A labelled action shows its words; an icon-only action names itself with a tooltip and an accessible label. */
export function MessageAction(props: {
  icon: LucideIcon;
  label: string;
  showLabel?: boolean;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
}) {
  const { icon: Icon } = props;
  const button = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={props.showLabel ? undefined : props.label}
      aria-pressed={props.pressed}
      disabled={props.disabled}
      onClick={props.onClick}
      className={props.showLabel ? "" : "w-7 px-0"}
    >
      <Icon aria-hidden className="size-3.5" />
      {props.showLabel ? props.label : null}
    </Button>
  );
  return props.showLabel ? button : <Tooltip tooltipContent={props.label}>{button}</Tooltip>;
}
