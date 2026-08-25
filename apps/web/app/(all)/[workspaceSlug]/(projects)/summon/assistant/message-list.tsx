/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef } from "react";
import { ArrowUpRight, Bot, Sparkles, User } from "lucide-react";
import type { ISummonAssistantMessage } from "@plane/types";
import Link from "next/link";
import { summonErrorMessage } from "@/components/summon/screen";
import { MarkdownRenderer } from "@/components/ui/markdown-to-component";

const SUGGESTED_PROMPTS = [
  "Ringkas status seluruh proyek aktif",
  "Temukan keputusan terbaru dari meeting",
  "Susun update progres untuk klien",
];

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
  onSuggestion: (prompt: string) => void;
}) {
  const { messages, pending, loading } = props;
  const latestMessageRef = useRef<HTMLDivElement>(null);
  useEffect(() => latestMessageRef.current?.scrollIntoView({ block: "end" }), [messages.length, pending]);

  if (!loading && !messages.length && !pending)
    return (
      <div className="grid min-h-[24rem] place-items-center px-4 text-center">
        <div className="max-w-xl">
          <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-accent-subtle text-accent-primary">
            <Sparkles className="size-5" />
          </span>
          <p className="text-lg mt-4 font-semibold tracking-tight text-primary">Apa yang ingin kamu ketahui?</p>
          <p className="text-sm mt-1 text-secondary">
            Tanya tentang proyek, dokumen, meeting, atau proses kerja Summon. Sumber yang dapat kamu akses akan dicari
            otomatis.
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => props.onSuggestion(prompt)}
                className="text-xs rounded-xl border border-subtle bg-surface-1 px-3 py-2.5 text-left text-secondary transition-colors hover:border-strong hover:bg-layer-1 hover:text-primary focus-visible:outline focus-visible:outline-2"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    );

  return (
    <>
      {messages.map((message) => (
        <article key={message.id} className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
          <span
            className={`grid size-8 flex-none place-items-center rounded-xl ${
              message.role === "user" ? "bg-accent-strong text-on-color" : "bg-accent-subtle text-accent-primary"
            }`}
          >
            {message.role === "user" ? <User className="size-4" /> : <Bot className="size-4" />}
          </span>
          <div className={`max-w-[88%] min-w-0 ${message.role === "user" ? "text-right" : ""}`}>
            <div
              className={`mb-1 flex gap-2 text-[11px] font-medium text-tertiary ${message.role === "user" ? "justify-end" : ""}`}
            >
              <span>{message.role === "user" ? "You" : "Summon Assistant"}</span>
              {message.role === "assistant" ? <span>{message.status}</span> : null}
            </div>
            <div
              className={`text-sm rounded-2xl px-4 py-3 text-left ${
                message.role === "user"
                  ? "bg-accent-strong text-on-color"
                  : "border border-subtle bg-layer-1 text-primary"
              }`}
            >
              {message.role === "assistant" ? (
                <div className="prose-sm dark:prose-invert max-w-none prose">
                  <MarkdownRenderer markdown={message.content} />
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{message.content}</p>
              )}
              {message.citations.length ? (
                <div className="mt-3 flex flex-wrap gap-2" aria-label="Sources">
                  {message.citations.map((citation) => (
                    <Link
                      key={`${message.id}-${citation.id}`}
                      href={citation.href}
                      onClick={(event) => {
                        if (!window.confirm(`Open ${citation.label}? No data will be changed.`)) event.preventDefault();
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-subtle bg-surface-1 px-2.5 py-1 text-[11px] font-medium text-accent-primary focus-visible:outline focus-visible:outline-2"
                    >
                      {citation.label} <ArrowUpRight className="size-3" />
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </article>
      ))}
      {pending ? (
        <div className="space-y-4" aria-live="polite">
          <div className="flex flex-row-reverse gap-3">
            <span className="bg-accent-strong grid size-8 flex-none place-items-center rounded-xl text-on-color">
              <User className="size-4" />
            </span>
            <div className="text-sm bg-accent-strong max-w-[88%] rounded-2xl px-4 py-3 text-on-color">{pending}</div>
          </div>
          <div className="flex gap-3">
            <span className="grid size-8 flex-none place-items-center rounded-xl bg-accent-subtle text-accent-primary">
              <Bot className="size-4" />
            </span>
            <div className="text-sm animate-pulse rounded-2xl border border-subtle bg-layer-1 px-4 py-3 text-secondary">
              Summon Assistant is thinking…
            </div>
          </div>
        </div>
      ) : null}
      <div ref={latestMessageRef} />
    </>
  );
}
