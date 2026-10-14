/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { HTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@plane/propel/icon-button";
import type { TInstanceLLMErrorCode } from "@plane/types";
import { PageHead } from "@/components/core/page-title";

/** The one card surface: every Summon card, panel and table draws this border, radius and shadow. */
const summonSurfaceClassName = "rounded-xl border border-subtle bg-surface-1 shadow-xs";

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
            <aside className={`min-w-0 p-3.5 ${summonSurfaceClassName}`}>{props.rail}</aside>
          </div>
        ) : (
          props.children
        )}
      </section>
    </>
  );
}

export function SummonCard(props: { children: ReactNode; className?: string }) {
  return <div className={`p-4 ${summonSurfaceClassName} ${props.className ?? ""}`}>{props.children}</div>;
}

/**
 * The one section heading inside a page: 14px title, an optional count, and on the right either a
 * "view all" style `link` or any `action` control.
 */
type SectionHeading = {
  title: ReactNode;
  count?: number;
  link?: { href: string; label: string };
  action?: ReactNode;
  /** `h3` when the section sits under another heading, such as inside a drawer. */
  as?: "h2" | "h3";
};

export function SummonSectionHeader(props: SectionHeading & { className?: string }) {
  const Heading = props.as ?? "h2";
  return (
    <header className={`flex min-h-6 items-center justify-between gap-3 ${props.className ?? ""}`}>
      <Heading className="flex min-w-0 items-center gap-2 text-sm font-semibold text-primary">
        <span className="truncate">{props.title}</span>
        {props.count !== undefined ? (
          <span className="rounded-sm bg-layer-1 px-1.5 text-12 font-medium text-tertiary tabular-nums">
            {props.count}
          </span>
        ) : null}
      </Heading>
      {props.link ? (
        <Link
          href={props.link.href}
          className="relative inline-flex flex-none items-center gap-1 text-12 font-medium text-accent-primary after:absolute after:-inset-x-2 after:-inset-y-3 hover:underline focus-visible:outline-2 focus-visible:outline-accent-strong focus-visible:outline-solid"
        >
          {props.link.label} <ArrowRight aria-hidden className="size-3" />
        </Link>
      ) : (
        props.action
      )}
    </header>
  );
}

/**
 * A titled card. The body is padded and grows to fill the card's height; `flush` hands the area under the
 * header to the children, for tables and edge-to-edge lists.
 */
export function SummonPanel(
  props: SectionHeading & { id?: string; flush?: boolean; className?: string; children: ReactNode }
) {
  const { id, flush, className, children, ...header } = props;
  return (
    <section
      id={id}
      className={`flex min-w-0 scroll-mt-24 flex-col overflow-hidden ${summonSurfaceClassName} ${className ?? ""}`}
    >
      <SummonSectionHeader {...header} className="px-4 pt-4 pb-3" />
      {flush ? children : <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">{children}</div>}
    </section>
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
      {props.detail ? (
        <p className="mt-0.5 truncate text-12 text-tertiary tabular-nums" title={props.detail}>
          {props.detail}
        </p>
      ) : null}
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
    <section className={`overflow-hidden ${summonSurfaceClassName} ${className ?? ""}`} {...attributes}>
      {filters ? <div className="border-b border-subtle px-3.5 py-2.5">{filters}</div> : null}
      {children}
    </section>
  );
}

/** Footer for a paged `SummonTableShell`: the visible range and previous/next. Hidden while the list is empty. */
export function SummonPagination(props: {
  page: number;
  pageSize: number;
  total: number;
  /** Plural noun for the range text, e.g. "resources". */
  noun: string;
  onPageChange: (page: number) => void;
}) {
  const { page, pageSize, total, noun, onPageChange } = props;
  if (!total) return null;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-subtle px-3.5 py-2.5">
      <p className="text-12 text-tertiary tabular-nums">
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} {noun}
      </p>
      {pageCount > 1 ? (
        <div className="flex items-center gap-1.5">
          <IconButton
            variant="secondary"
            size="sm"
            icon={ChevronLeft}
            aria-label="Previous page"
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
          />
          <span className="px-1 text-12 text-secondary tabular-nums">
            {page} / {pageCount}
          </span>
          <IconButton
            variant="secondary"
            size="sm"
            icon={ChevronRight}
            aria-label="Next page"
            disabled={page === pageCount}
            onClick={() => onPageChange(page + 1)}
          />
        </div>
      ) : null}
    </div>
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
            <p className="truncate text-13 font-medium text-primary" title={record.title}>
              {record.title}
            </p>
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

const SUMMON_LLM_ERROR_MESSAGES = {
  llm_not_configured: "Ask an instance administrator to configure an LLM, then retry.",
  llm_authentication_failed: "Provider authentication failed. Ask an instance administrator to verify the key.",
  llm_rate_limited: "The provider rate limit was reached. Wait briefly, then retry.",
  llm_timeout: "The provider timed out. Retry with less selected context.",
  llm_provider_unavailable: "The provider is unavailable. Wait briefly, then retry.",
  llm_invalid_response: "The provider returned an invalid response. Retry or ask an administrator to check the model.",
  llm_context_too_large: "The selected context is too large. Remove one or more sources, then retry.",
  transcript_required: "Supply an accessible text transcript before generating a summary.",
  project_required: "Select a project you can access before generating or publishing a page.",
  project_access_revoked: "Project access changed. Reopen the record and select a project you can access.",
  unsupported_document_type:
    "This legacy preview cannot create files. Generate a new preview with one of the current document templates.",
} satisfies Record<TInstanceLLMErrorCode, string> & Record<string, string>;

export function summonLLMErrorMessage(error: unknown) {
  let code: unknown;
  if (error && typeof error === "object") {
    if ("error_code" in error) code = error.error_code;
    else if ("code" in error) code = error.code;
  }
  return typeof code === "string" && Object.hasOwn(SUMMON_LLM_ERROR_MESSAGES, code)
    ? SUMMON_LLM_ERROR_MESSAGES[code as keyof typeof SUMMON_LLM_ERROR_MESSAGES]
    : summonErrorMessage(error);
}

/**
 * The content a section tab or filter chip shows. It rises in child by child (`t-stagger`) whenever `value`
 * changes, like a page opening; `contents` lays the children out as if the wrapper were not there.
 */
export function ViewPanel(props: { value: string; children: ReactNode }) {
  return (
    <div key={props.value} className="t-stagger contents">
      {props.children}
    </div>
  );
}
