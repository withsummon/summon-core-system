/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Circle, FileAudio, FileText, Plus, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@plane/propel/button";
import type { ISummonMeeting } from "@plane/types";
import { TimestampButton } from "./meeting-media";
import type { TSeek } from "./meeting-media";

type Props = {
  data: ISummonMeeting;
  workspaceSlug: string;
  onSeek: TSeek;
  summarizing: boolean;
  summaryError: string;
  onRegenerate: () => void;
};

type TSource = "minutes" | "imported";

const SUMMARY_ERROR_MESSAGES: Record<string, string> = {
  transcribing: "Transcribing the recording. Minutes can be generated when it finishes.",
  transcription_failed: "Transcription failed. Upload the recording again.",
  transcript_required: "Minutes need a transcript. Upload a recording first.",
  project_required: "Link this meeting to a project to generate minutes.",
};

function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <h2 className="mb-2 flex items-center gap-2 text-13 font-semibold text-primary">
      {children}
      {count ? <span className="text-12 font-medium text-tertiary tabular-nums">{count}</span> : null}
    </h2>
  );
}

/** tl;dv writes each note's moment as a link like `/app/meetings/<id>?t=1217`; those become playable moments. */
function noteMoment(href: string | undefined) {
  const match = href?.match(/[?&]t=(\d+)/);
  return match ? Number(match[1]) : null;
}

function ImportedNotes({ markdown, onSeek }: { markdown: string; onSeek: TSeek }) {
  return (
    <div className="space-y-1 text-13 leading-6 text-secondary [&_.task-list-item]:pl-[1.375rem] [&_.task-list-item]:-indent-[1.375rem] [&_h2]:mt-5 [&_h2]:mb-1.5 [&_h2]:text-13 [&_h2]:font-semibold [&_h2]:text-primary [&_h2:first-child]:mt-0 [&_h3]:mt-4 [&_h3]:font-semibold [&_h3]:text-primary [&_input]:mr-2 [&_input]:align-[-0.125em] [&_li]:py-0.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul.contains-task-list]:list-none [&_ul.contains-task-list]:pl-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            const moment = noteMoment(href);
            if (moment !== null) return <TimestampButton seconds={moment} onSeek={onSeek} />;
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent-primary underline">
                {children}
              </a>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

function Minutes({ summary }: { summary: NonNullable<ISummonMeeting["summary_page_detail"]> }) {
  return (
    <div className="space-y-6 text-13 leading-6 text-secondary">
      {summary.summary ? <p className="text-14 leading-6 text-primary">{summary.summary}</p> : null}
      {summary.decisions.length ? (
        <section>
          <SectionTitle count={summary.decisions.length}>Decisions</SectionTitle>
          <ul className="space-y-1.5">
            {summary.decisions.map((decision) => (
              <li key={decision} className="flex gap-2">
                <Check className="mt-1 size-3.5 shrink-0 text-success-primary" aria-hidden="true" />
                <span>{decision}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {summary.discussion_topics.length ? (
        <section>
          <SectionTitle>Discussion</SectionTitle>
          <div className="space-y-3">
            {summary.discussion_topics.map((topic) => (
              <div key={topic.topic}>
                <h3 className="font-medium text-primary">{topic.topic}</h3>
                <ul className="list-disc pl-5">
                  {topic.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {summary.next_actions.length ? (
        <section>
          <SectionTitle count={summary.next_actions.length}>Next actions</SectionTitle>
          <ul className="space-y-1.5">
            {summary.next_actions.map((item) => (
              <li key={item.action} className="flex gap-2">
                <Circle className="mt-1.5 size-3 shrink-0 text-placeholder" aria-hidden="true" />
                <span>
                  {item.action}
                  {item.owner || item.due_date ? (
                    <span className="text-tertiary"> · {[item.owner, item.due_date].filter(Boolean).join(" · ")}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {summary.open_items.length ? (
        <section>
          <SectionTitle count={summary.open_items.length}>Open questions</SectionTitle>
          <ul className="list-disc space-y-1 pl-5">
            {summary.open_items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ActionItems({ data, workspaceSlug }: Pick<Props, "data" | "workspaceSlug">) {
  const suggestions = data.summary_page_detail?.action_suggestions ?? [];
  const projectIssuesHref = data.project ? `/${workspaceSlug}/projects/${data.project}/issues/` : "";
  if (!data.work_items.length && !suggestions.length) return null;

  return (
    <section className="border-t border-subtle pt-5">
      <SectionTitle count={data.work_items.length}>Tasks</SectionTitle>
      <ul className="-mx-2">
        {data.work_items.map((workItem) => (
          <li key={workItem.id}>
            <Link
              href={`/${workspaceSlug}/projects/${workItem.issue.project.id}/issues/${workItem.issue.id}/`}
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-layer-transparent-hover"
            >
              {workItem.issue.completed ? (
                <span className="grid size-4 place-items-center rounded-full bg-success-primary text-white">
                  <Check className="size-3" aria-hidden="true" />
                </span>
              ) : (
                <Circle className="size-4 text-placeholder" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1 truncate text-13 text-primary">{workItem.issue.name}</span>
              <span className="text-12 text-tertiary">{workItem.issue.state?.name ?? "No state"}</span>
            </Link>
          </li>
        ))}
      </ul>
      {suggestions.length && projectIssuesHref ? (
        <div className="mt-3">
          <p className="mb-1 flex items-center gap-1.5 text-12 font-medium text-tertiary">
            <Sparkles className="size-3.5" aria-hidden="true" /> Suggested from the minutes
          </p>
          <ul className="-mx-2">
            {suggestions.map((suggestion) => (
              <li key={`${suggestion.title}-${suggestion.details}`}>
                <Link
                  href={projectIssuesHref}
                  title={suggestion.details}
                  className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-13 text-secondary hover:bg-layer-transparent-hover hover:text-primary"
                >
                  <Plus className="size-4 text-placeholder" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{suggestion.title}</span>
                  <span className="text-12 text-tertiary">Create in project</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Files({ data }: Pick<Props, "data">) {
  const files = [
    data.summary_page_detail
      ? { id: "minutes", name: data.summary_page_detail.name, href: data.summary_page_detail.href, icon: FileText }
      : null,
    data.transcript_asset_detail?.url
      ? {
          id: "transcript",
          name: data.transcript_asset_detail.name || "Transcript",
          href: data.transcript_asset_detail.url,
          icon: FileText,
        }
      : null,
    data.recording_asset_detail?.url
      ? {
          id: "recording",
          name: data.recording_asset_detail.name || "Recording",
          href: data.recording_asset_detail.url,
          icon: FileAudio,
        }
      : null,
  ].filter((file) => file !== null);
  if (!files.length) return null;

  return (
    <section className="border-t border-subtle pt-5">
      <SectionTitle>Files</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {files.map(({ id, name, href, icon: Icon }) => (
          <a
            key={id}
            href={href}
            className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-subtle px-2.5 py-1.5 text-12 font-medium text-secondary hover:bg-layer-transparent-hover hover:text-primary"
          >
            <Icon className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{name}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

const SOURCES = [
  ["minutes", "Summon minutes"],
  ["imported", "tl;dv notes"],
] as const;

/** Switches between Summon's minutes and tl;dv's notes when a meeting has both. */
function SourceToggle({ shown, onChange }: { shown: TSource; onChange: (source: TSource) => void }) {
  return (
    <div role="group" aria-label="Notes source" className="inline-flex rounded-md bg-layer-1 p-0.5">
      {SOURCES.map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={shown === value}
          onClick={() => onChange(value)}
          className={`rounded-sm px-2.5 py-1 text-12 font-medium transition-colors ${
            shown === value ? "bg-surface-1 text-primary shadow-xs" : "text-secondary hover:text-primary"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Why minutes are missing or failed; transcription in progress is a status, everything else an alert. */
function SummaryStatus({ storedError, requestError }: { storedError: string; requestError: string }) {
  const message = requestError || (storedError && (SUMMARY_ERROR_MESSAGES[storedError] ?? storedError));
  if (!message) return null;
  return (
    <p
      className="rounded-md bg-layer-1 px-3 py-2 text-12 text-secondary"
      role={!requestError && storedError === "transcribing" ? "status" : "alert"}
    >
      {message}
    </p>
  );
}

function NoNotes({ canGenerate }: { canGenerate: boolean }) {
  return (
    <div className="rounded-lg border border-dashed border-subtle px-4 py-8 text-center">
      <Sparkles className="mx-auto size-5 text-tertiary" aria-hidden="true" />
      <p className="mt-2 text-13 font-medium text-primary">No notes yet</p>
      <p className="mt-1 text-12 text-tertiary">
        {canGenerate
          ? "Generate minutes from the transcript: decisions, discussion and next actions."
          : "Notes appear once the meeting has a transcript: upload the recording or import it from tl;dv."}
      </p>
    </div>
  );
}

export function MeetingNotes({ data, workspaceSlug, onSeek, summarizing, summaryError, onRegenerate }: Props) {
  const minutes = data.summary_page_detail?.summary ? data.summary_page_detail : null;
  const imported = data.notes.trim();
  const [source, setSource] = useState<TSource>(minutes ? "minutes" : "imported");
  const shown: TSource | null =
    minutes && (source === "minutes" || !imported) ? "minutes" : imported ? "imported" : null;
  const canGenerate = Boolean(data.project && (data.transcript_text || data.transcript_asset_detail));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {minutes && imported ? (
          <SourceToggle shown={source} onChange={setSource} />
        ) : (
          <h2 className="text-14 font-semibold text-primary">
            {shown === "imported" ? "tl;dv notes" : "Meeting notes"}
          </h2>
        )}
        {canGenerate ? (
          <Button variant="secondary" size="sm" onClick={onRegenerate} loading={summarizing} disabled={summarizing}>
            <RefreshCw className={summarizing ? "animate-spin" : ""} />
            {minutes ? "Regenerate minutes" : "Generate minutes"}
          </Button>
        ) : null}
      </div>

      <SummaryStatus storedError={data.summary_error} requestError={summaryError} />

      {shown === "minutes" && minutes ? <Minutes summary={minutes} /> : null}
      {shown === "imported" ? <ImportedNotes markdown={imported} onSeek={onSeek} /> : null}
      {shown ? null : <NoNotes canGenerate={canGenerate} />}

      <ActionItems data={data} workspaceSlug={workspaceSlug} />
      <Files data={data} />
    </div>
  );
}
