/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Adapted from AI Elements (https://elements.ai-sdk.dev/components/conversation) onto propel primitives.
import type { ComponentProps, ReactNode } from "react";
import { ArrowDown } from "lucide-react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { IconButton } from "@plane/propel/icon-button";
import { cn } from "@plane/utils";

/** Scroll log that stays pinned to the newest message unless the reader scrolls up. */
export function Conversation({ className, ...props }: ComponentProps<typeof StickToBottom>) {
  return (
    <StickToBottom
      className={cn("relative min-h-0 flex-1 overflow-y-hidden", className)}
      initial="instant"
      resize="smooth"
      role="log"
      {...props}
    />
  );
}

export function ConversationContent({ className, ...props }: ComponentProps<typeof StickToBottom.Content>) {
  return (
    <StickToBottom.Content
      className={cn("mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6", className)}
      {...props}
    />
  );
}

export function ConversationEmptyState(props: {
  title: string;
  description?: string;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full flex-col items-center gap-6 text-center", props.className)}>
      <div className="flex flex-col items-center gap-3">
        {props.icon}
        <div className="space-y-1">
          <h2 className="text-20 font-semibold tracking-tight text-primary">{props.title}</h2>
          {props.description ? <p className="text-13 text-secondary">{props.description}</p> : null}
        </div>
      </div>
      {props.children}
    </div>
  );
}

/** Appears only while the reader is scrolled away from the newest message. */
export function ConversationScrollButton() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  if (isAtBottom) return null;
  return (
    <IconButton
      variant="secondary"
      size="base"
      icon={ArrowDown}
      aria-label="Scroll to latest message"
      onClick={() => void scrollToBottom()}
      className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full shadow-overlay-100"
    />
  );
}
