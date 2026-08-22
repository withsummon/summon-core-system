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
    <div className="relative overflow-hidden rounded-2xl border border-blue-100 dark:border-blue-900/50 bg-gradient-to-r from-blue-50/70 via-indigo-50/30 to-surface-1 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-surface-1 p-5 shadow-xs">
      <div className="space-y-4">
        {/* Header with Sparkle Icon */}
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-xs">
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-primary">Ask Summon Assistant anything</h2>
            <p className="text-xs text-secondary mt-0.5">
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
          className="relative flex items-center rounded-xl border border-subtle bg-surface-1 p-1.5 pl-4 shadow-xs focus-within:border-blue-500 transition-all"
        >
          <input
            type="text"
            placeholder="Ask a question about projects, clients, processes, or anything..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-primary placeholder:text-placeholder focus:outline-none"
          />
          <button
            type="submit"
            disabled={!query.trim() || isAsking}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-placeholder transition-all"
          >
            {isAsking ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
          </button>
        </form>

        {/* AI Answer Box if present */}
        {answer && (
          <div className="relative rounded-xl border border-blue-200 dark:border-blue-800 bg-surface-1 p-4 shadow-xs animate-in fade-in duration-200">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                <Bot size={15} />
                <span>Summon Assistant Answer</span>
              </div>
              <button
                type="button"
                onClick={() => setAnswer(null)}
                className="text-placeholder hover:text-primary transition-colors"
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
              className="rounded-full border border-subtle bg-surface-1 px-3 py-1.5 text-[11px] font-medium text-secondary hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-600 dark:hover:bg-blue-950/40 dark:hover:text-blue-400 transition-all shadow-2xs text-left"
            >
              {sq}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
