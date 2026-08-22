/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Button, Input, TextArea } from "@plane/ui";
import type { ISummonAutomationJob } from "@plane/types";
import { SummonField, SummonSelect } from "@/components/summon/forms";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonCard, SummonMetric, SummonScreen, summonLLMErrorMessage } from "@/components/summon/screen";
import { useProject } from "@/hooks/store/use-project";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";

export default function SummonAutomationPage({ params }: Route.ComponentProps) {
  const { joinedProjectIds, getProjectById } = useProject();
  const [template, setTemplate] = useState("");
  const [outputProject, setOutputProject] = useState("");
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [workspaceContext, setWorkspaceContext] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [clientId, setClientId] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const [pageIds, setPageIds] = useState<string[]>([]);
  const [activeJob, setActiveJob] = useState<ISummonAutomationJob>();
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [formError, setFormError] = useState("");
  const { data, error, isLoading, mutate } = useSWR(["summon-automation", params.workspaceSlug], async () => {
    const [templates, jobs, clients, meetings, pages] = await Promise.all([
      summonService.listAutomationTemplates(params.workspaceSlug),
      summonService.listAutomationJobs(params.workspaceSlug),
      summonService.listClients(params.workspaceSlug),
      summonService.listMeetings(params.workspaceSlug),
      summonService.listPageContexts(params.workspaceSlug),
    ]);
    return { templates, jobs, clients, meetings, pages };
  });
  const jobs = data?.jobs ?? [];
  const selectedJob = activeJob ?? jobs[0];

  const generatePreview = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setGenerating(true);
    setFormError("");
    try {
      const job = await summonService.generateAutomationPreview(params.workspaceSlug, {
        template,
        project: outputProject || null,
        input: { title, brief },
        context: {
          workspace: workspaceContext,
          project_id: projectId || undefined,
          client_id: clientId || undefined,
          meeting_id: meetingId || undefined,
          page_ids: pageIds,
        },
      });
      setActiveJob(job);
      await mutate();
    } catch (requestError) {
      setFormError(summonLLMErrorMessage(requestError));
      await mutate();
    } finally {
      setGenerating(false);
    }
  };

  const publishPreview = async () => {
    if (!selectedJob?.preview_markdown || selectedJob.artifacts.length) return;
    if (!window.confirm(`Publish ${title || selectedJob.type} to one canonical Plane Page?`)) return;
    setPublishing(true);
    setFormError("");
    try {
      const published = await summonService.publishAutomationJob(params.workspaceSlug, selectedJob.id);
      setActiveJob(published);
      await mutate();
    } catch (requestError) {
      setFormError(summonLLMErrorMessage(requestError));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <SummonScreen
      title="Automation Studio"
      description="Generate a validated LLM preview, review its authorized sources, then explicitly publish one Plane Page."
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <SummonMetric label="Templates" value={data?.templates.length ?? 0} detail="Instance LLM generators" />
        <SummonMetric label="Preview jobs" value={jobs.length} detail="Persistent generation history" />
        <SummonMetric
          label="Published"
          value={jobs.filter(({ published_at }) => Boolean(published_at)).length}
          detail="Canonical Plane Pages"
        />
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[23rem_minmax(0,1fr)_19rem]">
        <SummonCard>
          <h2 className="text-sm font-semibold text-primary">Document source</h2>
          <form onSubmit={generatePreview} className="mt-4 grid gap-3">
            <SummonField label="Template">
              <SummonSelect required value={template} onChange={(event) => setTemplate(event.target.value)}>
                <option value="">Select template</option>
                {data?.templates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </SummonSelect>
            </SummonField>
            <SummonField label="Output Plane Project">
              <SummonSelect required value={outputProject} onChange={(event) => setOutputProject(event.target.value)}>
                <option value="">Select Plane Project</option>
                {joinedProjectIds.map((id) => (
                  <option key={id} value={id}>
                    {getProjectById(id)?.name ?? id}
                  </option>
                ))}
              </SummonSelect>
            </SummonField>
            <SummonField label="Document title">
              <Input required value={title} onChange={(event) => setTitle(event.target.value)} />
            </SummonField>
            <SummonField label="Instructions">
              <TextArea
                required
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                placeholder="What should this document cover?"
              />
            </SummonField>
            <SummonField label="Project context">
              <SummonSelect value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                <option value="">No project source</option>
                {joinedProjectIds.map((id) => (
                  <option key={id} value={id}>
                    {getProjectById(id)?.name ?? id}
                  </option>
                ))}
              </SummonSelect>
            </SummonField>
            <SummonField label="Client context">
              <SummonSelect value={clientId} onChange={(event) => setClientId(event.target.value)}>
                <option value="">No client source</option>
                {data?.clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </SummonSelect>
            </SummonField>
            <SummonField label="Meeting context">
              <SummonSelect value={meetingId} onChange={(event) => setMeetingId(event.target.value)}>
                <option value="">No meeting source</option>
                {data?.meetings.map((meeting) => (
                  <option key={meeting.id} value={meeting.id}>
                    {meeting.title}
                  </option>
                ))}
              </SummonSelect>
            </SummonField>
            <SummonField label="Plane Pages context">
              <SummonSelect
                multiple
                value={pageIds}
                onChange={(event) => setPageIds(Array.from(event.target.selectedOptions, ({ value }) => value))}
                className="h-20 py-1.5"
              >
                {data?.pages.map((page) => (
                  <option key={page.id} value={page.page}>
                    {page.page_detail.name}
                  </option>
                ))}
              </SummonSelect>
            </SummonField>
            <label className="text-xs inline-flex items-center gap-2 font-medium text-secondary">
              <input
                type="checkbox"
                checked={workspaceContext}
                onChange={(event) => setWorkspaceContext(event.target.checked)}
                className="accent-accent-primary size-4"
              />
              Include workspace name
            </label>
            <Button
              type="submit"
              disabled={!template || !outputProject || !title || !brief.trim()}
              loading={generating}
            >
              Generate preview
            </Button>
            {formError ? (
              <div className="space-y-2" role="alert">
                <p className="text-xs text-danger-primary">{formError}</p>
                <Button type="button" size="sm" variant="neutral-primary" onClick={() => void generatePreview()}>
                  Retry preview
                </Button>
              </div>
            ) : null}
          </form>
        </SummonCard>
        <SummonCard>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-primary">Validated preview</h2>
              <p className="text-xs mt-1 text-secondary">
                {selectedJob
                  ? `${selectedJob.status}${selectedJob.provider ? ` · ${selectedJob.provider} · ${selectedJob.model}` : ""}`
                  : "Generate a preview without writing a Page."}
              </p>
            </div>
            <Button
              disabled={!selectedJob?.preview_markdown || Boolean(selectedJob.artifacts.length)}
              loading={publishing}
              onClick={() => void publishPreview()}
            >
              Publish to Plane Page
            </Button>
          </div>
          {selectedJob?.context_truncated ? (
            <p className="text-xs mt-3 rounded-lg bg-warning-subtle/20 px-3 py-2 text-warning-primary" role="status">
              Selected context was truncated to 30,000 characters.
            </p>
          ) : null}
          {selectedJob?.preview_markdown ? (
            <pre className="text-xs mt-4 max-h-[32rem] overflow-auto rounded-xl bg-layer-1 p-4 whitespace-pre-wrap text-primary">
              {selectedJob.preview_markdown}
            </pre>
          ) : (
            <p className="text-xs mt-4 text-tertiary">No preview yet.</p>
          )}
          {selectedJob?.citations.length ? (
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Citations">
              {selectedJob.citations.map((citation) => (
                <Link
                  key={citation.id}
                  href={citation.href}
                  onClick={(event) => {
                    if (!window.confirm(`Open ${citation.label}? No data will be changed.`)) event.preventDefault();
                  }}
                  className="text-xs rounded-lg border border-subtle px-2 py-1 font-medium text-accent-primary"
                >
                  {citation.label}
                </Link>
              ))}
            </div>
          ) : null}
          {selectedJob ? (
            <p className="mt-4 text-[11px] text-tertiary">
              Tokens: {selectedJob.input_tokens ?? "—"} in · {selectedJob.output_tokens ?? "—"} out
            </p>
          ) : null}
          {selectedJob?.artifacts[0]?.page_detail ? (
            <Link
              href={selectedJob.artifacts[0].page_detail.href}
              className="text-xs mt-4 inline-block font-semibold text-accent-primary"
            >
              Open published Plane Page →
            </Link>
          ) : null}
        </SummonCard>
        <SummonCard>
          <h2 className="text-sm font-semibold text-primary">Job history</h2>
          <SummonRequestState
            loading={isLoading}
            error={error}
            empty={!isLoading && jobs.length === 0}
            onRetry={() => void mutate()}
          />
          <div className="mt-3 divide-y divide-subtle">
            {jobs.map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => setActiveJob(job)}
                className="w-full py-3 text-left first:pt-0 last:pb-0"
              >
                <p className="text-xs truncate font-medium text-primary">
                  {typeof job.input.title === "string" ? job.input.title : job.type}
                </p>
                <p className="mt-1 text-[11px] text-secondary">
                  {job.status} · {job.provider || job.error_summary || "Pending"}
                </p>
              </button>
            ))}
          </div>
        </SummonCard>
      </div>
    </SummonScreen>
  );
}
