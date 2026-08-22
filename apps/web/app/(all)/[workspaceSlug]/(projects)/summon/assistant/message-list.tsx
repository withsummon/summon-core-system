/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ArrowUpRight, Sparkles } from "lucide-react";
import type { ISummonAssistantMessage } from "@plane/types";
import Link from "next/link";
import { summonErrorMessage } from "@/components/summon/screen";

export function assistantErrorMessage(error: unknown) {
  const code = error && typeof error === "object" && "error_code" in error ? error.error_code : undefined;
  switch (code) {
    case "llm_not_configured":
      return "Ask an instance administrator to configure an LLM, then retry.";
    case "llm_authentication_failed":
      return "Provider authentication failed. Ask an instance administrator to verify the key.";
    case "llm_rate_limited":
      return "The provider rate limit was reached. Wait briefly, then retry.";
    case "llm_timeout":
      return "The provider timed out. Retry with less selected context.";
    case "llm_provider_unavailable":
      return "The provider is unavailable. Wait briefly, then retry.";
    case "llm_invalid_response":
      return "The provider returned an invalid response. Retry or ask an administrator to check the model.";
    case "llm_context_too_large":
      return "The selected context is too large. Remove one or more sources, then retry.";
    default:
      return summonErrorMessage(error);
  }
}

export function AssistantMessageList(props: {
  messages: ISummonAssistantMessage[];
  pending: string;
  loading: boolean;
}) {
  const { messages, pending, loading } = props;
  if (!loading && !messages.length && !pending)
    return (
      <div className="grid min-h-56 place-items-center text-center">
        <div>
          <Sparkles className="mx-auto size-7 text-accent-primary" />
          <p className="text-sm mt-3 font-medium text-primary">How can I help?</p>
          <p className="text-xs mt-1 text-secondary">Select only the sources needed, then ask a question.</p>
        </div>
      </div>
    );

  return (
    <>
      {messages.map((message) => (
        <article
          key={message.id}
          className={`max-w-[88%] rounded-xl px-3.5 py-3 ${
            message.role === "user" ? "bg-accent-strong ml-auto text-on-color" : "bg-layer-1 text-primary"
          }`}
        >
          <div className="mb-1 flex gap-2 text-[11px] font-medium opacity-80">
            <span>{message.role === "user" ? "You" : "Summon Assistant"}</span>
            {message.role === "assistant" ? <span>{message.status}</span> : null}
          </div>
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          {message.citations.length ? (
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Citations">
              {message.citations.map((citation) => (
                <Link
                  key={`${message.id}-${citation.id}`}
                  href={citation.href}
                  onClick={(event) => {
                    if (!window.confirm(`Open ${citation.label}? No data will be changed.`)) event.preventDefault();
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-subtle bg-surface-1 px-2 py-1 text-[11px] font-medium text-accent-primary focus-visible:outline focus-visible:outline-2"
                >
                  {citation.label} <ArrowUpRight className="size-3" />
                </Link>
              ))}
            </div>
          ) : null}
        </article>
      ))}
      {pending ? (
        <div className="space-y-3" aria-live="polite">
          <div className="text-sm bg-accent-strong ml-auto max-w-[88%] rounded-xl px-3.5 py-3 text-on-color">
            {pending}
          </div>
          <div className="text-sm max-w-[88%] animate-pulse rounded-xl bg-layer-1 px-3.5 py-3 text-secondary">
            Summon Assistant is thinking…
          </div>
        </div>
      ) : null}
    </>
  );
}
