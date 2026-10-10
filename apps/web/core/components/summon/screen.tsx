/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { HTMLAttributes, ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { observer } from "mobx-react";
import { PageHead } from "@/components/core/page-title";
import { AppSidebarToggleButton } from "@/components/sidebar/sidebar-toggle-button";
import { useAppTheme } from "@/hooks/store/use-app-theme";

export const SummonScreen = observer(function SummonScreen(props: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
  rail?: ReactNode;
}) {
  const { sidebarCollapsed } = useAppTheme();

  return (
    <>
      <PageHead title={`${props.title} · Summon Core`} />
      <section className="relative mx-auto flex min-h-full w-full max-w-[1600px] flex-col gap-4 overflow-hidden p-4 lg:p-5">
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {sidebarCollapsed && <AppSidebarToggleButton />}
            <div>
              <h1 className="text-2xl font-semibold text-primary">{props.title}</h1>
              <p className="mt-1 max-w-3xl text-13 text-tertiary">{props.description}</p>
            </div>
          </div>
          {props.actions ? <div className="flex flex-wrap items-center gap-2">{props.actions}</div> : null}
        </div>
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
});

export function SummonCard(props: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-subtle bg-surface-1 p-4 shadow-xs ${props.className ?? ""}`}>
      {props.children}
    </div>
  );
}

export function SummonMetric(props: { label: string; value: ReactNode; detail?: string }) {
  return (
    <SummonCard className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-12 font-medium text-tertiary">{props.label}</p>
          <p className="mt-1.5 text-2xl font-semibold text-primary tabular-nums">{props.value}</p>
          {props.detail ? <p className="mt-1 truncate text-12 text-tertiary">{props.detail}</p> : null}
        </div>
        <span className="grid size-7 flex-shrink-0 place-items-center rounded-lg border border-subtle bg-surface-1 text-tertiary shadow-tactile">
          <ArrowUpRight className="size-4" />
        </span>
      </div>
    </SummonCard>
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
      return "Select an authorized Plane Project before generating or publishing a Page.";
    case "project_access_revoked":
      return "Project access changed. Reopen the record and select an authorized Plane Project.";
    case "unsupported_document_type":
      return "This legacy preview cannot create files. Generate a new preview with one of the current document templates.";
    default:
      return summonErrorMessage(error);
  }
}
