/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import { Check, Circle, FileAudio, FileText, ListTodo, RefreshCw, Sparkles } from "lucide-react";
import type { ISummonMeeting } from "@plane/types";

type Props = {
  data: ISummonMeeting;
  workspaceSlug: string;
  summarizing: boolean;
  summaryError: string;
  onRegenerate: () => void;
};

const timestamp = (value: string) =>
  new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));

function Panel(props: { id?: string; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={props.id} className="shadow-sm scroll-mt-24 rounded-xl border border-subtle bg-surface-1">
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <h2 className="text-sm font-semibold text-primary">{props.title}</h2>
        {props.action}
      </div>
      <div className="p-4 pt-3">{props.children}</div>
    </section>
  );
}

export function MeetingDetailRail({ data, workspaceSlug, summarizing, summaryError, onRegenerate }: Props) {
  const summary = data.summary_page_detail;
  const canRegenerate = Boolean(data.project && (data.transcript_text || data.transcript_asset_detail));
  const projectIssuesHref = data.project ? `/${workspaceSlug}/projects/${data.project}/issues/` : "";
  const documents = [
    summary
      ? { id: summary.id, name: summary.name, detail: "AI meeting summary", href: summary.href, icon: FileText }
      : null,
    data.transcript_asset_detail
      ? {
          id: data.transcript_asset_detail.id,
          name: data.transcript_asset_detail.name || "Meeting transcript",
          detail: "Transcript file",
          href: data.transcript_asset_detail.url,
          icon: FileText,
        }
      : null,
    data.recording_asset_detail
      ? {
          id: data.recording_asset_detail.id,
          name: data.recording_asset_detail.name || "Meeting recording",
          detail: "Recording file",
          href: data.recording_asset_detail.url,
          icon: FileAudio,
        }
      : null,
  ].filter((item) => item !== null);

  return (
    <aside className="space-y-3.5">
      <Panel
        id="ai-summary"
        title="AI Summary"
        action={
          <button
            type="button"
            onClick={onRegenerate}
            disabled={!canRegenerate || summarizing}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-accent-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw className={`size-3.5 ${summarizing ? "animate-spin" : ""}`} />
            {summarizing ? "Membuat MoM…" : summary ? "Buat Ulang MoM" : "Buat MoM"}
          </button>
        }
      >
        {summary?.summary ? (
          <div className="text-xs space-y-4 leading-5 text-secondary">
            <div>
              <p className="mb-1 font-semibold text-primary">Key Discussion</p>
              <p className="whitespace-pre-wrap">{summary.summary}</p>
            </div>
            <div>
              <p className="mb-2 font-semibold text-primary">Key Decisions</p>
              <ul className="space-y-1.5">
                {summary.decisions.map((decision) => (
                  <li key={decision} className="flex gap-2">
                    <span className="mt-0.5 grid size-3.5 flex-shrink-0 place-items-center rounded-full bg-accent-primary text-white">
                      <Check className="size-2.5" />
                    </span>
                    <span>{decision}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="text-xs flex gap-2 rounded-lg bg-layer-1 p-3 text-tertiary">
            <Sparkles className="size-4 flex-shrink-0 text-accent-primary" />
            No generated summary is available for this meeting.
          </div>
        )}
        {summaryError || data.summary_error ? (
          <p className="text-xs mt-3 text-danger-primary" role="alert">
            {summaryError ||
              (data.summary_error === "transcribing"
                ? "Audio sedang ditranskripsi. Tombol Buat MoM akan aktif setelah selesai."
                : data.summary_error === "transcription_failed"
                  ? "Transkripsi audio gagal. Silakan unggah ulang audio."
                  : data.summary_error)}
          </p>
        ) : null}
      </Panel>

      <Panel
        id="tasks"
        title="Action Items"
        action={
          data.project ? (
            <Link href={projectIssuesHref} className="text-[11px] font-semibold text-accent-primary">
              + Add Action Item
            </Link>
          ) : null
        }
      >
        <div className="divide-y divide-subtle">
          {data.work_items.map((workItem) => (
            <Link
              key={workItem.id}
              href={`/${workspaceSlug}/projects/${workItem.issue.project.id}/issues/${workItem.issue.id}/`}
              className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0"
            >
              {workItem.issue.completed ? (
                <span className="grid size-4 place-items-center rounded-full bg-accent-primary text-white">
                  <Check className="size-3" />
                </span>
              ) : (
                <Circle className="size-4 text-placeholder" />
              )}
              <span className="text-xs min-w-0 flex-1 truncate font-medium text-primary">{workItem.issue.name}</span>
              <span className="text-[10px] font-medium text-tertiary">{workItem.issue.state?.name ?? "No state"}</span>
            </Link>
          ))}
          {!data.work_items.length ? <p className="text-xs py-3 text-tertiary">No Plane action items linked.</p> : null}
        </div>
        {summary?.action_suggestions.length && data.project ? (
          <div className="mt-3 border-t border-subtle pt-3">
            <p className="mb-2 text-[10px] font-semibold tracking-wide text-tertiary uppercase">AI suggestions</p>
            {summary.action_suggestions.map((suggestion) => (
              <Link
                key={`${suggestion.title}-${suggestion.details}`}
                href={projectIssuesHref}
                onClick={(event) => {
                  if (!window.confirm(`Open Plane work items to create or link “${suggestion.title}”?`))
                    event.preventDefault();
                }}
                className="text-xs block py-1.5 font-medium text-primary hover:text-accent-primary"
              >
                + {suggestion.title}
              </Link>
            ))}
          </div>
        ) : null}
        {data.project ? (
          <Link
            href={projectIssuesHref}
            className="mt-3 block text-right text-[11px] font-semibold text-accent-primary"
          >
            View all tasks →
          </Link>
        ) : null}
      </Panel>

      <Panel id="documents" title="Related Documents">
        <div className="space-y-2.5">
          {documents.map(({ id, name, detail, href, icon: Icon }) => {
            const content = (
              <div className="flex items-center gap-2.5">
                <span className="grid size-7 place-items-center rounded-md bg-accent-subtle text-accent-primary">
                  <Icon className="size-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="text-xs block truncate font-semibold text-primary">{name}</span>
                  <span className="block text-[10px] text-tertiary">{detail}</span>
                </span>
              </div>
            );
            return href ? (
              <a key={id} href={href} className="block">
                {content}
              </a>
            ) : (
              <div key={id}>{content}</div>
            );
          })}
          {!documents.length ? <p className="text-xs py-2 text-tertiary">No related documents available.</p> : null}
        </div>
      </Panel>

      <Panel id="activity" title="Meeting Activity">
        <div className="space-y-3">
          <Activity icon={ListTodo} label="Meeting created" detail={`${timestamp(data.created_at)} · Summon Core`} />
          {data.work_items.map((item) => (
            <Activity
              key={item.id}
              icon={Check}
              label={`Action item linked · ${item.issue.name}`}
              detail={timestamp(item.created_at)}
            />
          ))}
          {data.summary_provider ? (
            <Activity
              icon={Sparkles}
              label="AI Summary generated"
              detail={`${timestamp(data.updated_at)} · Summon Assistant`}
            />
          ) : null}
        </div>
      </Panel>
    </aside>
  );
}

function Activity({ icon: Icon, label, detail }: { icon: React.ElementType; label: string; detail: string }) {
  return (
    <div className="flex gap-2.5">
      <span className="grid size-7 flex-shrink-0 place-items-center rounded-full bg-accent-subtle text-accent-primary">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs truncate font-medium text-primary">{label}</p>
        <p className="mt-0.5 text-[10px] text-tertiary">{detail}</p>
      </div>
    </div>
  );
}
