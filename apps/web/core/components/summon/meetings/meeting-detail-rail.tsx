/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Link } from "react-router";
import type { MeetingDetailProps } from "./meeting-detail-workspace";
import { Check, Circle, FileText, ListTodo, RefreshCw, Sparkles } from "lucide-react";

const timestamp = (value: number) =>
  new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));

function Panel(props: { id?: string; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={props.id} className="shadow-sm scroll-mt-24 rounded-xl border border-subtle bg-surface-1">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
        <h2 className="text-sm font-semibold text-primary">{props.title}</h2>
        {props.action}
      </div>
      <div className="p-4 pt-3">{props.children}</div>
    </section>
  );
}

export function MeetingDetailRail(props: MeetingDetailProps) {
  return (
    <aside className="min-w-0 space-y-3.5">
      <MeetingSummary {...props} />
      <MeetingActionItems {...props} />
      <MeetingRelatedDocuments {...props} />
      <MeetingActivity {...props} />
    </aside>
  );
}

function MeetingSummary({ source, summary: run, summarizing, onRegenerate }: MeetingDetailProps) {
  const summary = run?.published?.result ?? null;
  const canRegenerate = source?.available && source.canSummarize;
  const generating = run?.status === "running";
  const summaryError =
    run?.status === "failed"
      ? run.error === "provider_unconfigured"
        ? "An AI provider is not configured. Your transcript is saved."
        : run.error === "cancelled"
          ? "Summary cancelled. The current document is unchanged."
          : "The summary could not be saved. Check source access and document changes before retrying."
      : "";
  return (
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
          <RefreshCw className={`size-3.5 ${generating ? "animate-spin" : ""}`} />
          {generating ? "Membuat MoM…" : summary ? "Buat Ulang MoM" : "Buat MoM"}
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
      {run?.publicationStale && (
        <p className="text-xs mt-3 text-secondary">The source or document has changed since this summary.</p>
      )}
      {summaryError ? (
        <p className="text-xs mt-3 text-danger-primary" role="alert">
          {summaryError}
        </p>
      ) : null}
    </Panel>
  );
}

function MeetingActionItems({
  context,
  summary: run,
  links,
  linksComplete,
  onLoadLinks,
  workspaceSlug,
}: MeetingDetailProps) {
  const data = context.meeting;
  const summary = run?.published?.result ?? null;
  const projectIssuesHref = data.projectId ? `/${workspaceSlug}/projects/${data.projectId}/issues/` : "";
  return (
    <Panel
      id="tasks"
      title="Action Items"
      action={
        data.projectId ? (
          <Link to={projectIssuesHref} className="text-[11px] font-semibold text-accent-primary">
            + Add Action Item
          </Link>
        ) : null
      }
    >
      <div className="divide-y divide-subtle">
        {links.map((link) =>
          link.task ? (
            <Link
              key={link.linkId}
              to={`/${workspaceSlug}/projects/${link.task.projectId}/issues/${link.task._id}/`}
              className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0"
            >
              {link.task.status === "done" ? (
                <span className="grid size-4 place-items-center rounded-full bg-accent-primary text-white">
                  <Check className="size-3" />
                </span>
              ) : (
                <Circle className="size-4 text-placeholder" />
              )}
              <span className="text-xs min-w-0 flex-1 truncate font-medium text-primary">{link.task.title}</span>
              <span className="text-[10px] font-medium text-tertiary">{link.state?.name ?? link.task.status}</span>
            </Link>
          ) : (
            <p key={link.linkId} className="text-xs py-2 text-tertiary">
              This linked work item is unavailable.
            </p>
          )
        )}
        {linksComplete && !links.length ? (
          <p className="text-xs py-3 text-tertiary">No Plane action items linked.</p>
        ) : null}
        {onLoadLinks && (
          <button type="button" onClick={onLoadLinks} className="text-xs font-medium text-accent-primary">
            Load more action items
          </button>
        )}
      </div>
      {summary?.action_suggestions.length && data.projectId ? (
        <div className="mt-3 border-t border-subtle pt-3">
          <p className="mb-2 text-[10px] font-semibold tracking-wide text-tertiary uppercase">AI suggestions</p>
          {summary.action_suggestions.map((suggestion) => (
            <Link
              key={`${suggestion.title}-${suggestion.details}`}
              to={projectIssuesHref}
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
      {data.projectId ? (
        <Link to={projectIssuesHref} className="mt-3 block text-right text-[11px] font-semibold text-accent-primary">
          View all tasks →
        </Link>
      ) : null}
    </Panel>
  );
}

function MeetingRelatedDocuments({
  context,
  source,
  summary: run,
  recording,
  recordingUrl,
  workspaceSlug,
  onDownloadRecording,
}: MeetingDetailProps) {
  const data = context.meeting;
  const summary = run?.published?.result ?? null;
  return (
    <Panel id="documents" title="Related Documents">
      <div className="space-y-2.5">
        {source?.available && source.documentId && data.projectId && (
          <Link
            to={`/${workspaceSlug}/projects/${data.projectId}/pages/${source.documentId}/`}
            className="flex items-center gap-2.5"
          >
            <span className="grid size-7 place-items-center rounded-md bg-accent-subtle text-accent-primary">
              <FileText className="size-3.5" />
            </span>
            <span className="min-w-0">
              <span className="text-xs block truncate font-semibold text-primary">
                {data.title} · {summary ? "MoM" : "Transcript"}
              </span>
              <span className="block text-[10px] text-tertiary">Canonical meeting document</span>
            </span>
          </Link>
        )}
        {recording && (
          <button
            type="button"
            disabled={!recordingUrl}
            onClick={onDownloadRecording}
            className="text-xs font-semibold text-primary"
          >
            {recording.name} · Recording file
          </button>
        )}
        {!recording && (!source?.available || !source.documentId) && (
          <p className="text-xs py-2 text-tertiary">No accessible related documents available.</p>
        )}
      </div>
    </Panel>
  );
}

function MeetingActivity({ context, links, summary: run }: MeetingDetailProps) {
  const data = context.meeting;
  const published = run?.published;
  return (
    <Panel id="activity" title="Meeting Activity">
      <div className="space-y-3">
        <Activity icon={ListTodo} label="Meeting created" detail={`${timestamp(data._creationTime)} · Summon Core`} />
        {links.map((link) => (
          <Activity
            key={link.linkId}
            icon={Check}
            label={`Action item linked · ${link.task?.title ?? "Unavailable work item"}`}
            detail={timestamp(link.createdAt)}
          />
        ))}
        {published?.result ? (
          <Activity
            icon={Sparkles}
            label="Successful summary request"
            detail={`${timestamp(published._creationTime)} · Summon Assistant`}
          />
        ) : null}
      </div>
    </Panel>
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
