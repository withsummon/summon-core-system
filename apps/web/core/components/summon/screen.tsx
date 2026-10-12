/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { HTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHead } from "@/components/core/page-title";

/** The one gutter and width every Summon page uses. */
export const summonPageClassName = "mx-auto flex min-h-full w-full max-w-[1600px] flex-col gap-4 p-4 lg:p-5";

/** The one page header: 20px title, optional one-line description, actions on the right. */
export function SummonPageHeader(props: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-20 font-semibold tracking-tight text-primary">{props.title}</h1>
        {props.description ? <p className="mt-0.5 max-w-3xl text-13 text-tertiary">{props.description}</p> : null}
      </div>
      {props.actions ? <div className="flex min-w-0 flex-wrap items-center gap-2">{props.actions}</div> : null}
    </header>
  );
}

export function SummonScreen(props: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
  rail?: ReactNode;
}) {
  return (
    <>
      <PageHead title={`${props.title} · Summon Core`} />
      <section className={summonPageClassName}>
        <SummonPageHeader title={props.title} description={props.description} actions={props.actions} />
        {props.rail ? (
          <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="min-w-0">{props.children}</div>
            <aside className="min-w-0 rounded-xl border border-subtle bg-surface-1 p-3.5 shadow-xs">{props.rail}</aside>
          </div>
        ) : (
          props.children
        )}
      </section>
    </>
  );
}

export function SummonCard(props: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-subtle bg-surface-1 p-4 shadow-xs ${props.className ?? ""}`}>
      {props.children}
    </div>
  );
}

/** One row of real numbers. Cells divide with hairlines; two columns on a phone. */
export function SummonMetricStrip(props: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-subtle bg-(--border-color-subtle) shadow-xs sm:auto-cols-fr sm:grid-flow-col sm:grid-cols-none [&>:last-child:nth-child(odd)]:col-span-2 sm:[&>:last-child:nth-child(odd)]:col-span-1 ${props.className ?? ""}`}
    >
      {props.children}
    </div>
  );
}

/** A metric cell for `SummonMetricStrip`. With `href` the whole cell navigates. */
export function SummonMetric(props: { label: string; value: ReactNode; detail?: string; href?: string }) {
  const body = (
    <>
      <p className="flex items-center justify-between gap-2 text-12 font-medium text-tertiary">
        <span className="truncate">{props.label}</span>
        {props.href ? <ChevronRight aria-hidden className="size-3.5 flex-none text-placeholder" /> : null}
      </p>
      <p className="mt-1 text-20 font-semibold tracking-tight text-primary tabular-nums">{props.value}</p>
      {props.detail ? <p className="mt-0.5 truncate text-12 text-tertiary">{props.detail}</p> : null}
    </>
  );
  const cell = "min-w-0 bg-surface-1 px-4 py-3";
  return props.href ? (
    <Link href={props.href} className={`${cell} transition-colors hover:bg-layer-1`}>
      {body}
    </Link>
  ) : (
    <div className={cell}>{body}</div>
  );
}

export function SummonTableShell(props: HTMLAttributes<HTMLDivElement> & { children: ReactNode; filters?: ReactNode }) {
  const { children, className, filters, ...attributes } = props;
  return (
    <section
      className={`overflow-hidden rounded-xl border border-subtle bg-surface-1 shadow-xs ${className ?? ""}`}
      {...attributes}
    >
      {filters ? <div className="border-b border-subtle px-3.5 py-2.5">{filters}</div> : null}
      {children}
    </section>
  );
}

export function SummonRecordList(props: {
  records: Array<{ id: string; title: string; detail?: string; badge?: string }>;
}) {
  return (
    <SummonTableShell className="divide-y divide-subtle">
      {props.records.map((record) => (
        <div key={record.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-layer-1">
          <div className="min-w-0">
            <p className="truncate text-13 font-medium text-primary">{record.title}</p>
            {record.detail ? <p className="mt-0.5 text-12 break-words text-tertiary">{record.detail}</p> : null}
          </div>
          {record.badge ? (
            <span className="rounded-sm bg-layer-1 px-1.5 py-0.5 text-12 font-medium text-secondary ring ring-subtle ring-inset">
              {record.badge}
            </span>
          ) : null}
        </div>
      ))}
    </SummonTableShell>
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

export function summonLLMErrorMessage(error: unknown) {
  let code: unknown;
  if (error && typeof error === "object") {
    if ("error_code" in error) code = error.error_code;
    else if ("code" in error) code = error.code;
  }
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
    case "transcript_required":
      return "Supply an accessible text transcript before generating a summary.";
    case "project_required":
      return "Select a project you can access before generating or publishing a page.";
    case "project_access_revoked":
      return "Project access changed. Reopen the record and select a project you can access.";
    case "unsupported_document_type":
      return "This legacy preview cannot create files. Generate a new preview with one of the current document templates.";
    default:
      return summonErrorMessage(error);
  }
}
