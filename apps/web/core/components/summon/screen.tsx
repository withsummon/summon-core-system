/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { PageHead } from "@/components/core/page-title";

export function SummonScreen(props: { title: string; description: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <>
      <PageHead title={`${props.title} · Summon Core`} />
      <section className="relative mx-auto flex min-h-full w-full max-w-[1600px] flex-col gap-4 overflow-hidden p-4 lg:p-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-[radial-gradient(circle_at_30%_0%,rgba(54,107,255,0.08),transparent_64%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] text-accent-primary uppercase">
              <Sparkles className="size-3.5" />
              Summon Core
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-primary">{props.title}</h1>
            <p className="text-xs mt-1 max-w-3xl text-secondary">{props.description}</p>
          </div>
          {props.actions}
        </div>
        {props.children}
      </section>
    </>
  );
}

export function SummonCard(props: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-subtle bg-surface-1 p-3.5 shadow-[0_8px_30px_rgba(36,55,99,0.035)] ${props.className ?? ""}`}
    >
      {props.children}
    </div>
  );
}

export function SummonMetric(props: { label: string; value: ReactNode; detail?: string }) {
  return (
    <SummonCard className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-secondary">{props.label}</p>
          <p className="text-xl mt-1.5 font-semibold tracking-tight text-primary">{props.value}</p>
          {props.detail ? <p className="text-xs mt-1 truncate text-tertiary">{props.detail}</p> : null}
        </div>
        <span className="grid size-7 flex-shrink-0 place-items-center rounded-lg bg-accent-subtle text-accent-primary">
          <ArrowUpRight className="size-4" />
        </span>
      </div>
    </SummonCard>
  );
}

export function SummonRecordList(props: {
  records: Array<{ id: string; title: string; detail?: string; badge?: string }>;
}) {
  return (
    <div className="divide-y divide-subtle overflow-hidden rounded-2xl border border-subtle bg-surface-1">
      {props.records.map((record) => (
        <div key={record.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-layer-1">
          <div className="min-w-0">
            <p className="text-sm truncate font-medium text-primary">{record.title}</p>
            {record.detail ? <p className="text-xs mt-1 break-words text-secondary">{record.detail}</p> : null}
          </div>
          {record.badge ? (
            <span className="rounded-full bg-layer-2 px-2 py-1 text-[11px] font-medium text-secondary">
              {record.badge}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function summonErrorMessage(error: unknown) {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const first = Object.values(error as Record<string, unknown>)[0];
    if (typeof first === "string") return first;
    if (Array.isArray(first) && typeof first[0] === "string") return first[0];
  }
  return "Request failed. Please check the fields and try again.";
}
