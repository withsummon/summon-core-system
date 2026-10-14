/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { Sparkles, ArrowRight, Loader2, Bot, Check, X } from "lucide-react";
import { SUGGESTED_QUERIES } from "./mock-data";

interface IAskAssistantCardProps {
  onAskQuestion?: (question: string) => void;
}

export const AskAssistantCard: React.FC<IAskAssistantCardProps> = ({ onAskQuestion }) => {
  const [query, setQuery] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  const handleSubmit = (questionText?: string) => {
    const q = (questionText || query).trim();
    if (!q || isAsking) return;

    setQuery(q);
    setIsAsking(true);
    setAnswer(null);

    setTimeout(() => {
      setIsAsking(false);
      if (q.toLowerCase().includes("architecture") || q.toLowerCase().includes("bsb")) {
        setAnswer(
          "The BSB Logistic Management System uses an event-driven microservices architecture hosted on AWS. It features a Kong API Gateway, Golang dispatch service, Kafka telemetry pipeline, and TimescaleDB with Redis caching for real-time fleet coordinates."
        );
      } else if (q.toLowerCase().includes("sanfind") || q.toLowerCase().includes("lessons")) {
        setAnswer(
          "Lessons learned from the SANFIND project highlight that optimizing Redis pipeline buffering reduced sensor heartbeat latency from 840ms to 120ms. In addition, automated Cypress tests caught critical regressions before client staging cutover."
        );
      } else if (q.toLowerCase().includes("mom") || q.toLowerCase().includes("template")) {
        setAnswer(
          "The latest company MoM template is stored under Company Knowledge (updated by Wibi Susanto 1 day ago). It includes standard sections for Meeting Objectives, Discussion Points, Key Decisions, and Action Items with assignees."
        );
      } else {
        setAnswer(
          `Based on your company knowledge base, here is the synthesis for "${q}": All related project documentation, client meeting transcripts, and engineering guidelines have been indexed and verified with 100% citation accuracy.`
        );
      }
      onAskQuestion?.(q);
    }, 1000);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-accent-subtle bg-accent-subtle p-5 shadow-xs">
      <div className="space-y-4">
        {/* Header with Sparkle Icon */}
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-primary text-on-color shadow-xs">
            <Sparkles size={20} className="text-on-color" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-primary">Ask Summon Assistant anything</h2>
            <p className="mt-0.5 text-xs text-secondary">
              Get instant answers from your knowledge base and project context.
            </p>
          </div>
        </div>

        {/* Question Input Box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="relative flex items-center rounded-xl border border-subtle bg-surface-1 p-1.5 pl-4 shadow-xs transition-colors focus-within:border-accent-strong"
        >
          <input
            type="text"
            placeholder="Ask a question about projects, clients, processes, or anything…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-primary outline-none placeholder:text-placeholder"
          />
          <button
            type="submit"
            disabled={!query.trim() || isAsking}
            aria-label="Ask"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-primary text-on-color transition-colors hover:bg-accent-primary-hover disabled:bg-layer-2 disabled:text-placeholder"
          >
            {isAsking ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
          </button>
        </form>

        {/* AI Answer Box if present */}
        {answer && (
          <div className="animate-in fade-in relative rounded-xl border border-accent-subtle bg-surface-1 p-4 shadow-xs duration-200">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-accent-primary">
                <Bot size={15} />
                <span>Summon Assistant Answer</span>
              </div>
              <button
                type="button"
                aria-label="Dismiss answer"
                onClick={() => setAnswer(null)}
                className="text-placeholder transition-colors hover:text-primary"
              >
                <X size={14} />
              </button>
            </div>
            <p className="text-xs leading-relaxed text-primary">{answer}</p>
          </div>
        )}

        {/* Suggested Query Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {SUGGESTED_QUERIES.map((sq) => (
            <button
              key={sq}
              type="button"
              onClick={() => handleSubmit(sq)}
              className="rounded-full border border-subtle bg-surface-1 px-3 py-1.5 text-left text-[11px] font-medium text-secondary shadow-2xs transition-colors hover:border-accent-strong hover:bg-accent-subtle hover:text-accent-primary"
            >
              {sq}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
