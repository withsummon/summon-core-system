/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Button } from "@plane/ui";
import { SummonField, SummonSelect } from "@/components/summon/forms";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonCard, SummonScreen, summonLLMErrorMessage } from "@/components/summon/screen";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";

export default function SummonMeetingDetailPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, meetingId } = params;
  const [transcriptSource, setTranscriptSource] = useState<"text" | "asset">("text");
  const [includeProjectContext, setIncludeProjectContext] = useState(false);
  const [pageIds, setPageIds] = useState<string[]>([]);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const { data, error, isLoading, mutate } = useSWR(["summon-meeting", workspaceSlug, meetingId], () =>
    summonService.getMeeting(workspaceSlug, meetingId)
  );
  const { data: pages } = useSWR(["summon-meeting-pages", workspaceSlug], () =>
    summonService.listPageContexts(workspaceSlug)
  );

  const generateSummary = async () => {
    if (!data) return;
    setSummarizing(true);
    setSummaryError("");
    try {
      await summonService.summarizeMeeting(workspaceSlug, meetingId, {
        transcript_source: data.transcript_text ? transcriptSource : "asset",
        context: {
          project_id: includeProjectContext ? (data.project ?? undefined) : undefined,
          page_ids: pageIds,
        },
      });
      await mutate();
    } catch (requestError) {
      setSummaryError(summonLLMErrorMessage(requestError));
      await mutate();
    } finally {
      setSummarizing(false);
    }
  };

  if (!data) return <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />;

  return (
    <SummonScreen
      title={data.title}
      description={`${new Date(data.starts_at).toLocaleString()} · ${data.status}`}
      actions={
        <Link
          href={`/${workspaceSlug}/summon/meetings/`}
          className="text-xs rounded-xl border border-subtle px-3 py-2 font-medium text-primary"
        >
          All meetings
        </Link>
      }
    >
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.85fr)]">
        <div className="space-y-4">
          <SummonCard>
            <h2 className="text-sm font-semibold text-primary">Agenda and decisions</h2>
            <p className="text-xs mt-3 whitespace-pre-wrap text-secondary">{data.agenda || "No agenda supplied."}</p>
            <p className="text-xs mt-4 whitespace-pre-wrap text-primary">
              {data.notes || "No decisions or notes yet."}
            </p>
          </SummonCard>
          <SummonCard>
            <h2 className="text-sm font-semibold text-primary">Transcript</h2>
            {data.transcript_text ? (
              <p className="text-xs mt-3 whitespace-pre-wrap text-secondary">{data.transcript_text}</p>
            ) : data.transcript_asset_detail ? (
              <Asset asset={data.transcript_asset_detail} label="Transcript file" />
            ) : (
              <p className="text-xs mt-3 text-tertiary">No transcript supplied.</p>
            )}
            <div className="mt-4 grid gap-3 border-t border-subtle pt-4 sm:grid-cols-2">
              <SummonField label="Transcript source">
                <SummonSelect
                  value={data.transcript_text ? transcriptSource : "asset"}
                  onChange={(event) => setTranscriptSource(event.target.value === "asset" ? "asset" : "text")}
                >
                  <option value="text" disabled={!data.transcript_text}>
                    Supplied text
                  </option>
                  <option value="asset" disabled={!data.transcript_asset_detail}>
                    Attached text FileAsset
                  </option>
                </SummonSelect>
              </SummonField>
              <SummonField label="Plane Pages context">
                <SummonSelect
                  multiple
                  value={pageIds}
                  onChange={(event) => setPageIds(Array.from(event.target.selectedOptions, ({ value }) => value))}
                  className="h-16 py-1.5"
                >
                  {pages?.map((page) => (
                    <option key={page.id} value={page.page}>
                      {page.page_detail.name}
                    </option>
                  ))}
                </SummonSelect>
              </SummonField>
            </div>
            {data.project ? (
              <label className="text-xs mt-3 inline-flex items-center gap-2 font-medium text-secondary">
                <input
                  type="checkbox"
                  checked={includeProjectContext}
                  onChange={(event) => setIncludeProjectContext(event.target.checked)}
                  className="accent-accent-primary size-4"
                />
                Include linked project context
              </label>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button
                disabled={!data.project || (!data.transcript_text && !data.transcript_asset_detail)}
                loading={summarizing}
                onClick={() => void generateSummary()}
              >
                Generate summary
              </Button>
              <p className="text-[11px] text-tertiary">
                {data.project
                  ? "Only the selected transcript and context are sent."
                  : "Link an authorized Plane Project before generating a summary."}
              </p>
            </div>
            {summaryError || data.summary_error ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2" role="alert">
                <p className="text-xs text-danger-primary">
                  {summaryError || summonLLMErrorMessage({ error_code: data.summary_error })}
                </p>
                <Button type="button" size="sm" variant="neutral-primary" onClick={() => void generateSummary()}>
                  Retry summary
                </Button>
              </div>
            ) : null}
          </SummonCard>
          <SummonCard>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-primary">AI meeting summary</h2>
                <p className="text-xs mt-1 text-secondary">
                  {data.summary_provider
                    ? `${data.summary_provider} · ${data.summary_model}`
                    : "Available after explicit generation."}
                </p>
              </div>
              {data.summary_page_detail?.href ? (
                <Link href={data.summary_page_detail.href} className="text-xs font-semibold text-accent-primary">
                  Open Plane Page →
                </Link>
              ) : null}
            </div>
            {data.summary_page_detail?.summary ? (
              <>
                <p className="text-sm mt-4 whitespace-pre-wrap text-primary">{data.summary_page_detail.summary}</p>
                <h3 className="text-xs mt-5 font-semibold text-primary">Decisions</h3>
                <ul className="text-xs mt-2 list-disc space-y-1 pl-5 text-secondary">
                  {data.summary_page_detail.decisions.map((decision) => (
                    <li key={decision}>{decision}</li>
                  ))}
                  {!data.summary_page_detail.decisions.length ? <li>No decisions extracted.</li> : null}
                </ul>
                <h3 className="text-xs mt-5 font-semibold text-primary">Suggested action items</h3>
                <div className="mt-2 divide-y divide-subtle">
                  {data.summary_page_detail.action_suggestions.map((suggestion) => (
                    <div key={`${suggestion.title}-${suggestion.details}`} className="py-3 first:pt-0 last:pb-0">
                      <p className="text-xs font-medium text-primary">{suggestion.title}</p>
                      <p className="mt-1 text-[11px] text-secondary">{suggestion.details}</p>
                      {data.project ? (
                        <Link
                          href={`/${workspaceSlug}/projects/${data.project}/issues/`}
                          onClick={(event) => {
                            if (!window.confirm(`Open Plane work items to create or link “${suggestion.title}”?`))
                              event.preventDefault();
                          }}
                          className="mt-2 inline-block text-[11px] font-semibold text-accent-primary"
                        >
                          Confirm and open Plane work items →
                        </Link>
                      ) : (
                        <p className="mt-2 text-[11px] text-tertiary">Link a project before creating a work item.</p>
                      )}
                    </div>
                  ))}
                  {!data.summary_page_detail.action_suggestions.length ? (
                    <p className="text-xs py-2 text-tertiary">No action items suggested.</p>
                  ) : null}
                </div>
                {data.summary_page_detail.citations.length ? (
                  <div className="mt-4 flex flex-wrap gap-2" aria-label="Citations">
                    {data.summary_page_detail.citations.map((citation) => (
                      <Link
                        key={citation.id}
                        href={citation.href}
                        onClick={(event) => {
                          if (!window.confirm(`Open ${citation.label}? No data will be changed.`))
                            event.preventDefault();
                        }}
                        className="rounded-lg border border-subtle px-2 py-1 text-[11px] font-medium text-accent-primary"
                      >
                        {citation.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
                {data.summary_page_detail.context_truncated ? (
                  <p className="text-xs mt-3 text-warning-primary" role="status">
                    Selected source context was truncated to 30,000 characters.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-xs mt-4 text-tertiary">No generated summary is available.</p>
            )}
          </SummonCard>
          <SummonCard>
            <h2 className="text-sm font-semibold text-primary">Plane action items</h2>
            <div className="mt-3 divide-y divide-subtle">
              {data.work_items.map((workItem) => (
                <Link
                  key={workItem.id}
                  href={`/${workspaceSlug}/projects/${workItem.issue.project.id}/issues/${workItem.issue.id}/`}
                  className="block py-2.5 first:pt-0 last:pb-0"
                >
                  <p className="text-xs font-medium text-primary">{workItem.issue.name}</p>
                  <p className="mt-1 text-[10px] text-secondary">
                    {workItem.issue.project.identifier} · {workItem.issue.state?.name ?? "No state"}
                  </p>
                </Link>
              ))}
              {!data.work_items.length ? <p className="text-xs py-2 text-tertiary">No Plane action items.</p> : null}
            </div>
          </SummonCard>
        </div>
        <div className="space-y-4">
          <SummonCard>
            <h2 className="text-xs font-semibold text-primary">Recording</h2>
            {data.recording_asset_detail ? (
              <Asset asset={data.recording_asset_detail} label="Recording" />
            ) : (
              <p className="text-xs mt-3 text-tertiary">No recording attached.</p>
            )}
          </SummonCard>
          <SummonCard>
            <h2 className="text-xs font-semibold text-primary">Participants</h2>
            <div className="mt-3 divide-y divide-subtle">
              {data.participants.map((participant) => (
                <div key={participant.id} className="py-2 first:pt-0 last:pb-0">
                  <p className="text-xs font-medium text-primary">{participant.member.display_name}</p>
                  <p className="mt-1 text-[10px] text-secondary">{participant.response}</p>
                </div>
              ))}
              {!data.participants.length ? <p className="text-xs py-2 text-tertiary">No participants added.</p> : null}
            </div>
          </SummonCard>
          <SummonCard>
            <h2 className="text-xs font-semibold text-primary">Related Plane context</h2>
            {data.project_detail ? (
              <Link
                href={`/${workspaceSlug}/projects/${data.project_detail.id}/issues/`}
                className="text-xs mt-3 block font-medium text-accent-primary"
              >
                {data.project_detail.identifier} · {data.project_detail.name} →
              </Link>
            ) : (
              <p className="text-xs mt-3 text-tertiary">Workspace meeting.</p>
            )}
            {data.summary_provider ? (
              <p className="text-xs mt-3 text-secondary">
                Summary tokens: {data.summary_input_tokens ?? "—"} in · {data.summary_output_tokens ?? "—"} out
              </p>
            ) : null}
          </SummonCard>
        </div>
      </div>
    </SummonScreen>
  );
}

function Asset({ asset, label }: { asset: { id: string; name: string; url: string | null }; label: string }) {
  return asset.url ? (
    <a href={asset.url} className="text-xs mt-3 block font-medium text-accent-primary">
      {label}: {asset.name || asset.id} →
    </a>
  ) : (
    <p className="text-xs mt-3 text-secondary">
      {label}: {asset.name || asset.id}
    </p>
  );
}
