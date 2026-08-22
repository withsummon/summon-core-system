/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Button, Input, TextArea } from "@plane/ui";
import type { ISummonAutomationJob, ISummonGeneratedArtifact } from "@plane/types";
import { SummonField, SummonSelect } from "@/components/summon/forms";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonCard, SummonMetric, SummonScreen, summonLLMErrorMessage } from "@/components/summon/screen";
import { useProject } from "@/hooks/store/use-project";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";
import {
  automationInputValue,
  buildAutomationInput,
  isMultilineTemplateVariable,
  syncTemplateVariableValues,
  templateVariableLabel,
  templateVariableNames,
} from "./automation-form";

const OUTPUT_FORMAT_LABELS: Record<ISummonGeneratedArtifact["format"], string> = {
  page: "Plane Page",
  pdf: "PDF",
  docx: "DOCX",
  xlsx: "XLSX",
  pptx: "PPTX",
};

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
  const [rendering, setRendering] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [formError, setFormError] = useState("");
  const [renderError, setRenderError] = useState("");
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [previewDirty, setPreviewDirty] = useState(false);
  const draftVersion = useRef(0);
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
  const selectedTemplate = data?.templates.find(({ id }) => id === template);
  const templateVariables = templateVariableNames(selectedTemplate?.variables ?? []);
  const selectedJob = activeJob ?? jobs[0];
  const pageArtifact = selectedJob?.artifacts.find(({ page_detail }) => page_detail);
  const fileArtifacts = selectedJob?.artifacts.filter(({ file_detail }) => file_detail) ?? [];
  const canGeneratePreview = Boolean(
    template &&
    outputProject &&
    title.trim() &&
    brief.trim() &&
    templateVariables.every((variable) => variableValues[variable]?.trim())
  );
  const hasValidPreview = !previewDirty && selectedJob?.status === "completed" && Boolean(selectedJob.preview_markdown);
  const selectedJobTitle = selectedJob ? automationInputValue(selectedJob.input, "title") || selectedJob.type : "";
  const selectedJobProject = selectedJob?.project
    ? (getProjectById(selectedJob.project)?.name ?? selectedJob.project)
    : "no Plane project";

  const invalidatePreview = () => {
    draftVersion.current += 1;
    setPreviewDirty(true);
  };

  const updateDraft = <T,>(setter: (value: T) => void, value: T) => {
    setter(value);
    invalidatePreview();
  };

  const selectTemplate = (templateId: string) => {
    const variables = data?.templates.find(({ id }) => id === templateId)?.variables ?? [];
    setTemplate(templateId);
    setVariableValues((current) => syncTemplateVariableValues(variables, current));
    invalidatePreview();
  };

  const updateVariable = (variable: string, value: string) => {
    setVariableValues((current) => ({ ...current, [variable]: value }));
    invalidatePreview();
  };

  const generatePreview = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!canGeneratePreview) return;
    const submittedVersion = draftVersion.current;
    setGenerating(true);
    setPreviewDirty(true);
    setFormError("");
    setRenderError("");
    try {
      const job = await summonService.generateAutomationPreview(params.workspaceSlug, {
        template,
        project: outputProject || null,
        input: buildAutomationInput(selectedTemplate?.variables ?? [], title, brief, variableValues),
        context: {
          workspace: workspaceContext,
          project_id: projectId || undefined,
          client_id: clientId || undefined,
          meeting_id: meetingId || undefined,
          page_ids: pageIds,
        },
      });
      setActiveJob(job);
      if (job.status === "completed" && job.preview_markdown && submittedVersion === draftVersion.current) {
        setPreviewDirty(false);
      } else {
        setPreviewDirty(true);
      }
      await mutate();
    } catch (requestError) {
      setFormError(summonLLMErrorMessage(requestError));
      await mutate();
    } finally {
      setGenerating(false);
    }
  };

  const publishPreview = async () => {
    if (!selectedJob || !hasValidPreview || pageArtifact) return;
    if (!window.confirm(`Publish ${selectedJobTitle} from ${selectedJobProject} to one canonical Plane Page?`)) return;
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

  const generateFiles = async () => {
    if (!selectedJob || !hasValidPreview) return;
    setRendering(true);
    setRenderError("");
    try {
      const rendered = await summonService.renderAutomationJob(params.workspaceSlug, selectedJob.id);
      setActiveJob(rendered);
      await mutate();
    } catch (requestError) {
      setRenderError(summonLLMErrorMessage(requestError));
    } finally {
      setRendering(false);
    }
  };

  return (
    <SummonScreen
      title="AI Document Generator"
      description="Generate a validated LLM preview, then create editable office files and PDF or separately publish one Plane Page."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummonMetric
          label="Template categories"
          value={data?.templates.length ?? 0}
          detail="Loaded from the Automation API"
        />
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
              <SummonSelect required value={template} onChange={(event) => selectTemplate(event.target.value)}>
                <option value="">Select template</option>
                {data?.templates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </SummonSelect>
            </SummonField>
            <SummonField label="Output Plane Project">
              <SummonSelect
                required
                value={outputProject}
                onChange={(event) => updateDraft(setOutputProject, event.target.value)}
              >
                <option value="">Select Plane Project</option>
                {joinedProjectIds.map((id) => (
                  <option key={id} value={id}>
                    {getProjectById(id)?.name ?? id}
                  </option>
                ))}
              </SummonSelect>
            </SummonField>
            <SummonField label="Document title">
              <Input required value={title} onChange={(event) => updateDraft(setTitle, event.target.value)} />
            </SummonField>
            <SummonField label="Instructions">
              <TextArea
                required
                value={brief}
                onChange={(event) => updateDraft(setBrief, event.target.value)}
                placeholder="What should this document cover?"
              />
            </SummonField>
            {templateVariables.map((variable) => (
              <SummonField key={variable} label={templateVariableLabel(variable)}>
                {isMultilineTemplateVariable(variable) ? (
                  <TextArea
                    required
                    value={variableValues[variable] ?? ""}
                    onChange={(event) => updateVariable(variable, event.target.value)}
                    placeholder="Enter one item per line or structured details"
                  />
                ) : (
                  <Input
                    required
                    value={variableValues[variable] ?? ""}
                    onChange={(event) => updateVariable(variable, event.target.value)}
                  />
                )}
              </SummonField>
            ))}
            <SummonField label="Project context">
              <SummonSelect value={projectId} onChange={(event) => updateDraft(setProjectId, event.target.value)}>
                <option value="">No project source</option>
                {joinedProjectIds.map((id) => (
                  <option key={id} value={id}>
                    {getProjectById(id)?.name ?? id}
                  </option>
                ))}
              </SummonSelect>
            </SummonField>
            <SummonField label="Client context">
              <SummonSelect value={clientId} onChange={(event) => updateDraft(setClientId, event.target.value)}>
                <option value="">No client source</option>
                {data?.clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </SummonSelect>
            </SummonField>
            <SummonField label="Meeting context">
              <SummonSelect value={meetingId} onChange={(event) => updateDraft(setMeetingId, event.target.value)}>
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
                onChange={(event) =>
                  updateDraft(
                    setPageIds,
                    Array.from(event.target.selectedOptions, ({ value }) => value)
                  )
                }
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
                onChange={(event) => updateDraft(setWorkspaceContext, event.target.checked)}
                className="accent-accent-primary size-4"
              />
              Include workspace name
            </label>
            <Button type="submit" disabled={!canGeneratePreview} loading={generating}>
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
            <div className="flex flex-wrap gap-2">
              <Button
                variant="neutral-primary"
                disabled={!hasValidPreview || Boolean(fileArtifacts.length)}
                loading={rendering}
                onClick={() => void generateFiles()}
              >
                Generate files
              </Button>
              <Button
                disabled={!hasValidPreview || Boolean(pageArtifact)}
                loading={publishing}
                onClick={() => void publishPreview()}
              >
                Publish to Plane Page
              </Button>
            </div>
          </div>
          {previewDirty ? (
            <p className="text-xs mt-3 text-warning-primary" role="status">
              Inputs changed. Generate a new preview before creating files or publishing.
            </p>
          ) : null}
          {renderError ? (
            <div className="mt-3 flex flex-wrap items-center gap-2" role="alert">
              <p className="text-xs text-danger-primary">{renderError}</p>
              <Button type="button" size="sm" variant="neutral-primary" onClick={() => void generateFiles()}>
                Retry file generation
              </Button>
            </div>
          ) : null}
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
          {fileArtifacts.length ? (
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-primary">Generated files</h3>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {fileArtifacts.map((artifact) =>
                  artifact.file_detail ? (
                    <li key={artifact.id}>
                      <a
                        href={artifact.file_detail.href}
                        download={artifact.file_detail.name}
                        aria-label={`Download ${OUTPUT_FORMAT_LABELS[artifact.format]} file ${artifact.file_detail.name}`}
                        className="text-xs flex items-center justify-between gap-2 rounded-lg border border-subtle px-3 py-2 font-medium text-accent-primary"
                      >
                        <span className="truncate">{artifact.file_detail.name}</span>
                        <span>{OUTPUT_FORMAT_LABELS[artifact.format]}</span>
                      </a>
                    </li>
                  ) : null
                )}
              </ul>
            </div>
          ) : null}
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
          {pageArtifact?.page_detail ? (
            <Link
              href={pageArtifact.page_detail.href}
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
                aria-pressed={selectedJob?.id === job.id}
                onClick={() => setActiveJob(job)}
                className={`w-full rounded-lg px-2 py-3 text-left first:pt-0 last:pb-0 ${
                  selectedJob?.id === job.id ? "bg-layer-2" : "hover:bg-layer-1"
                }`}
              >
                <p className="text-xs truncate font-medium text-primary">
                  {automationInputValue(job.input, "title") || job.type}
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
