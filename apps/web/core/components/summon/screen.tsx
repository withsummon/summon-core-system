/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { HTMLAttributes, ReactNode } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
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
        <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-[radial-gradient(circle_at_30%_0%,rgba(54,107,255,0.08),transparent_64%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {sidebarCollapsed && <AppSidebarToggleButton />}
            <div>
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] text-accent-primary uppercase">
                <Sparkles className="size-3.5" />
                Summon Core
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-primary">{props.title}</h1>
              <p className="text-xs mt-1 max-w-3xl text-secondary">{props.description}</p>
            </div>
          </div>
          {props.actions ? <div className="flex flex-wrap items-center gap-2">{props.actions}</div> : null}
        </div>
        {props.rail ? (
          <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="min-w-0">{props.children}</div>
            <aside className="min-w-0 rounded-2xl border border-subtle bg-surface-1 p-3.5">{props.rail}</aside>
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

export function SummonTableShell(props: HTMLAttributes<HTMLDivElement> & { children: ReactNode; filters?: ReactNode }) {
  const { children, className, filters, ...attributes } = props;
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-subtle bg-surface-1 ${className ?? ""}`}
      {...attributes}
    >
      {filters ? <div className="border-b border-subtle bg-layer-1/50 px-3.5 py-2.5">{filters}</div> : null}
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
    default:
      return summonErrorMessage(error);
  }
}
