/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { PageHead } from "@/components/core/page-title";

export function SummonScreen(props: { title: string; description: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <>
      <PageHead title={`${props.title} · Summon Core`} />
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-primary">{props.title}</h1>
            <p className="text-sm mt-1 max-w-3xl text-secondary">{props.description}</p>
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
    <div className={`rounded-lg border border-subtle bg-surface-1 p-4 ${props.className ?? ""}`}>{props.children}</div>
  );
}

export function SummonRecordList(props: {
  records: Array<{ id: string; title: string; detail?: string; badge?: string }>;
}) {
  return (
    <div className="divide-y divide-subtle rounded-lg border border-subtle bg-surface-1">
      {props.records.map((record) => (
        <div key={record.id} className="flex items-start justify-between gap-3 p-4">
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
