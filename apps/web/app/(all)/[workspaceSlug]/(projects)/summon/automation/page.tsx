/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  MoreHorizontal,
  Presentation,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import { Button, Input, TextArea } from "@plane/ui";
import type { ISummonAutomationJob, ISummonAutomationTemplate, ISummonGeneratedArtifact } from "@plane/types";
import { PageHead } from "@/components/core/page-title";
import { SummonField, SummonSelect } from "@/components/summon/forms";
import { SummonRequestState } from "@/components/summon/request-state";
import { summonLLMErrorMessage } from "@/components/summon/screen";
import { useProject } from "@/hooks/store/use-project";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";
import {
  automationInputValue,
  buildAutomationInput,
  filterAutomationJobs,
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

const templateOrder = [
  "proposal_client",
  "quotation",
  "mom_summon",
  "presentation",
  "cost_projection",
  "proposal_vendor",
];

const templateLabel = (type: string) =>
  type
    .replace(/^proposal_(client|vendor)$/, "technical proposal")
    .replace(/^mom_(iglo|summon)$/, "minutes of meeting")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const templateVisual = (type: string) => {
  if (type === "quotation") return { Icon: FileSpreadsheet, tone: "bg-emerald-50 text-emerald-600" };
  if (type.startsWith("mom_")) return { Icon: BookOpen, tone: "bg-violet-50 text-violet-600" };
  if (type === "presentation") return { Icon: Presentation, tone: "bg-orange-50 text-orange-600" };
  if (type === "cost_projection") return { Icon: FileSpreadsheet, tone: "bg-cyan-50 text-cyan-600" };
  if (type.includes("proposal")) return { Icon: FileText, tone: "bg-blue-50 text-blue-600" };
  return { Icon: FileCheck2, tone: "bg-indigo-50 text-indigo-600" };
};

const outputFormats = (type?: string) => {
  if (type === "presentation") return ["pptx", "pdf"] as const;
  if (["usage_cost", "cost_projection", "timeline", "bug_report"].includes(type ?? "")) return ["xlsx", "pdf"] as const;
  return ["docx", "pdf"] as const;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));

const jobStatus = (job: ISummonAutomationJob) => {
  if (job.status === "completed")
    return {
      label: job.artifacts.length ? "Completed" : "Preview",
      className: "bg-emerald-50 text-emerald-700",
    };
  if (job.status === "failed") return { label: "Failed", className: "bg-red-50 text-red-600" };
  return {
    label: job.status === "running" ? "Running" : "Queued",
    className: "bg-amber-50 text-amber-700",
  };
};

const orderedTemplates = (templates: ISummonAutomationTemplate[]) =>
  // eslint-disable-next-line unicorn/no-array-sort -- the app target does not include ES2023 Array#toSorted.
  [...templates].sort((left, right) => {
    const leftIndex = templateOrder.indexOf(left.type);
    const rightIndex = templateOrder.indexOf(right.type);
    return (
      (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex) || left.name.localeCompare(right.name)
    );
  });

export default function SummonAutomationPage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  const { joinedProjectIds, getProjectById } = useProject();
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState("all");
  const [page, setPage] = useState(1);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [template, setTemplate] = useState("");
  const [outputProject, setOutputProject] = useState("");
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [tone, setTone] = useState("Professional");
  const [detailLevel, setDetailLevel] = useState("Comprehensive");
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
  const { data, error, isLoading, mutate } = useSWR(["summon-automation", workspaceSlug], async () => {
    const [templates, jobs, clients, meetings, pages] = await Promise.all([
      summonService.listAutomationTemplates(workspaceSlug),
      summonService.listAutomationJobs(workspaceSlug),
      summonService.listClients(workspaceSlug),
      summonService.listMeetings(workspaceSlug),
      summonService.listPageContexts(workspaceSlug),
    ]);
    return { templates, jobs, clients, meetings, pages };
  });
  const jobs = useMemo(() => data?.jobs ?? [], [data?.jobs]);
  const templates = useMemo(() => orderedTemplates(data?.templates ?? []), [data?.templates]);
  const selectedTemplate = templates.find(({ id }) => id === template);
  const templateVariables = templateVariableNames(selectedTemplate?.variables ?? []);
  const selectedJob = activeJob ?? jobs[0];
  const pageArtifact = selectedJob?.artifacts.find(({ page_detail }) => page_detail);
  const fileArtifacts = selectedJob?.artifacts.filter(({ file_detail }) => file_detail) ?? [];
  const projectNames = useMemo(
    () => new Map(joinedProjectIds.map((id) => [id, getProjectById(id)?.name ?? id])),
    [getProjectById, joinedProjectIds]
  );
  const filteredJobs = useMemo(
    () => filterAutomationJobs(jobs, projectNames, query, activeType),
    [activeType, jobs, projectNames, query]
  );
  const pageCount = Math.max(1, Math.ceil(filteredJobs.length / 8));
  const currentPage = Math.min(page, pageCount);
  const pagedJobs = filteredJobs.slice((currentPage - 1) * 8, currentPage * 8);
  const types = useMemo(
    () => Array.from(new Set([...templates.map(({ type }) => type), ...jobs.map(({ type }) => type)])),
    [jobs, templates]
  );
  const canGeneratePreview = Boolean(
    template && outputProject && title.trim() && templateVariables.every((variable) => variableValues[variable]?.trim())
  );
  const hasValidPreview = !previewDirty && selectedJob?.status === "completed" && Boolean(selectedJob.preview_markdown);
  const selectedJobTitle = selectedJob
    ? automationInputValue(selectedJob.input, "title") || templateLabel(selectedJob.type)
    : "";
  const selectedJobProject = selectedJob?.project
    ? (projectNames.get(selectedJob.project) ?? selectedJob.project)
    : "No project";

  const invalidatePreview = () => {
    draftVersion.current += 1;
    setPreviewDirty(true);
  };

  const updateDraft = <T,>(setter: (value: T) => void, value: T) => {
    setter(value);
    invalidatePreview();
  };

  const selectTemplate = (templateId: string) => {
    const item = templates.find(({ id }) => id === templateId);
    setTemplate(templateId);
    setVariableValues((current) => syncTemplateVariableValues(item?.variables ?? [], current));
    if (!title.trim() && item) setTitle(item.name);
    invalidatePreview();
  };

  const selectProject = (value: string) => {
    setOutputProject(value);
    setProjectId(value);
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
      const job = await summonService.generateAutomationPreview(workspaceSlug, {
        template,
        project: outputProject,
        input: {
          ...buildAutomationInput(selectedTemplate?.variables ?? [], title, brief, variableValues),
          tone,
          detail_level: detailLevel,
        },
        context: {
          workspace: workspaceContext,
          project_id: projectId || outputProject,
          client_id: clientId || undefined,
          meeting_id: meetingId || undefined,
          page_ids: pageIds,
        },
      });
      setActiveJob(job);
      setDetailsOpen(true);
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
      const published = await summonService.publishAutomationJob(workspaceSlug, selectedJob.id);
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
      const rendered = await summonService.renderAutomationJob(workspaceSlug, selectedJob.id);
      setActiveJob(rendered);
      await mutate();
    } catch (requestError) {
      setRenderError(summonLLMErrorMessage(requestError));
    } finally {
      setRendering(false);
    }
  };

  return (
    <section className="mx-auto min-h-full w-full max-w-[1600px] overflow-hidden p-4 lg:p-5">
      <PageHead title="Automation Studio · Summon Core" />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Automation Studio</h1>
          <p className="text-xs mt-1 text-secondary">AI-powered document generation and business automation</p>
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <div role="search" className="relative hidden w-full max-w-[460px] md:block">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tertiary" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search templates, documents, or ask anything..."
              className="h-10 rounded-xl pr-12 pl-9"
            />
            <span className="absolute top-1/2 right-3 -translate-y-1/2 text-[10px] font-semibold text-tertiary">
              ⌘ K
            </span>
          </div>
          <button
            type="button"
            aria-label="Notifications"
            className="grid size-10 place-items-center rounded-xl border border-subtle bg-surface-1 text-secondary"
          >
            <Bell className="size-4" />
          </button>
          <Link
            href={`/${workspaceSlug}/summon/knowledge/`}
            aria-label="Knowledge"
            className="grid size-10 place-items-center rounded-xl border border-subtle bg-surface-1 text-secondary"
          >
            <BookOpen className="size-4" />
          </Link>
          <Link
            href={`/${workspaceSlug}/summon/settings/`}
            className="text-xs inline-flex h-10 items-center gap-2 rounded-xl border border-subtle bg-surface-1 px-3 font-medium text-primary"
          >
            <Settings className="size-4" /> Studio Settings
          </Link>
        </div>
      </header>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-primary">Create New</h2>
          <a href="#template-library" className="text-xs font-medium text-accent-primary">
            View all templates →
          </a>
        </div>
        <SummonRequestState
          loading={isLoading}
          error={error}
          empty={!isLoading && templates.length === 0}
          onRetry={() => void mutate()}
        />
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-6">
          {templates.slice(0, 6).map((item) => {
            const { Icon, tone: iconTone } = templateVisual(item.type);
            return (
              <a
                key={item.id}
                href="#automation-generator"
                onClick={() => selectTemplate(item.id)}
                className={`group flex min-h-28 flex-col rounded-2xl border bg-surface-1 p-4 transition-colors hover:border-accent-strong ${
                  template === item.id ? "ring-accent-primary/20 border-accent-strong ring-1" : "border-subtle"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${iconTone}`}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-primary">{item.name}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-secondary">
                      {item.description ||
                        `Generate ${templateLabel(item.type).toLowerCase()} from verified workspace context.`}
                    </p>
                  </div>
                </div>
                <ArrowRight className="mt-auto size-4 self-end text-tertiary transition-transform group-hover:translate-x-0.5" />
              </a>
            );
          })}
        </div>
      </section>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[310px_minmax(0,1fr)]">
        <section
          id="automation-generator"
          className="rounded-2xl border border-subtle bg-surface-1 p-3.5 shadow-[0_8px_30px_rgba(36,55,99,0.035)]"
        >
          <h2 className="text-sm font-semibold text-primary">AI Document Generator</h2>
          <p className="mt-1 text-[11px] text-secondary">
            Generate a validated preview before creating editable office files and PDF.
          </p>
          <form onSubmit={generatePreview} className="mt-5 grid gap-4">
            <div className="relative pl-7">
              <span className="absolute top-0 left-0 grid size-5 place-items-center rounded-full bg-accent-primary text-[10px] font-semibold text-white">
                1
              </span>
              <SummonField label="Select Template">
                <SummonSelect
                  required
                  value={template}
                  onChange={(event) => selectTemplate(event.target.value)}
                  className="w-full"
                >
                  <option value="">Select template</option>
                  {data?.templates.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </SummonSelect>
              </SummonField>
            </div>
            <div className="relative pl-7">
              <span className="absolute top-0 left-0 grid size-5 place-items-center rounded-full bg-accent-primary text-[10px] font-semibold text-white">
                2
              </span>
              <SummonField label="Select Project Context">
                <SummonSelect
                  required
                  value={outputProject}
                  onChange={(event) => selectProject(event.target.value)}
                  className="w-full"
                >
                  <option value="">Select Plane Project</option>
                  {joinedProjectIds.map((id) => (
                    <option key={id} value={id}>
                      {getProjectById(id)?.name ?? id}
                    </option>
                  ))}
                </SummonSelect>
              </SummonField>
            </div>
            <div className="relative grid gap-2.5 pl-7">
              <span className="absolute top-0 left-0 grid size-5 place-items-center rounded-full bg-accent-primary text-[10px] font-semibold text-white">
                3
              </span>
              <SummonField label="Document Title">
                <Input
                  required
                  value={title}
                  onChange={(event) => updateDraft(setTitle, event.target.value)}
                  placeholder="Name this document"
                />
              </SummonField>
              <SummonField label="Additional Context (Optional)">
                <TextArea
                  value={brief}
                  onChange={(event) => updateDraft(setBrief, event.target.value)}
                  placeholder="Add project, scope, or client-specific requirements..."
                  className="min-h-20"
                />
              </SummonField>
              {templateVariables.length ? (
                <details className="rounded-xl border border-subtle bg-layer-1/40 p-2.5" open>
                  <summary className="cursor-pointer text-[11px] font-semibold text-primary">
                    Required document fields
                  </summary>
                  <div className="mt-3 grid gap-2.5">
                    {templateVariables.map((variable) => (
                      <SummonField key={variable} label={templateVariableLabel(variable)}>
                        {isMultilineTemplateVariable(variable) ? (
                          <TextArea
                            required
                            value={variableValues[variable] ?? ""}
                            onChange={(event) => updateVariable(variable, event.target.value)}
                            placeholder="Enter one item per line or structured details"
                            className="min-h-16"
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
                  </div>
                </details>
              ) : null}
              <details className="rounded-xl border border-subtle bg-layer-1/40 p-2.5">
                <summary className="cursor-pointer text-[11px] font-semibold text-primary">
                  More verified context
                </summary>
                <div className="mt-3 grid gap-2.5">
                  <SummonField label="Client">
                    <SummonSelect
                      value={clientId}
                      onChange={(event) => updateDraft(setClientId, event.target.value)}
                      className="w-full"
                    >
                      <option value="">No client source</option>
                      {data?.clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </SummonSelect>
                  </SummonField>
                  <SummonField label="Meeting">
                    <SummonSelect
                      value={meetingId}
                      onChange={(event) => updateDraft(setMeetingId, event.target.value)}
                      className="w-full"
                    >
                      <option value="">No meeting source</option>
                      {data?.meetings.map((meeting) => (
                        <option key={meeting.id} value={meeting.id}>
                          {meeting.title}
                        </option>
                      ))}
                    </SummonSelect>
                  </SummonField>
                  <SummonField label="Plane Pages">
                    <SummonSelect
                      multiple
                      value={pageIds}
                      onChange={(event) =>
                        updateDraft(
                          setPageIds,
                          Array.from(event.target.selectedOptions, ({ value }) => value)
                        )
                      }
                      className="h-20 w-full py-1.5"
                    >
                      {data?.pages.map((item) => (
                        <option key={item.id} value={item.page}>
                          {item.page_detail.name}
                        </option>
                      ))}
                    </SummonSelect>
                  </SummonField>
                  <label className="inline-flex items-center gap-2 text-[11px] font-medium text-secondary">
                    <input
                      type="checkbox"
                      checked={workspaceContext}
                      onChange={(event) => updateDraft(setWorkspaceContext, event.target.checked)}
                      className="accent-accent-primary size-4"
                    />
                    Include workspace name
                  </label>
                </div>
              </details>
            </div>
            <div className="relative pl-7">
              <span className="absolute top-0 left-0 grid size-5 place-items-center rounded-full bg-accent-primary text-[10px] font-semibold text-white">
                4
              </span>
              <p className="text-xs font-medium text-secondary">Output Preferences</p>
              <div className="mt-2 flex gap-2">
                {outputFormats(selectedTemplate?.type).map((format) => (
                  <span
                    key={format}
                    className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-accent-strong bg-accent-subtle/20 text-[11px] font-semibold text-accent-primary"
                  >
                    <FileText className="size-3.5" /> {OUTPUT_FORMAT_LABELS[format]}
                  </span>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <SummonField label="Tone">
                  <SummonSelect
                    value={tone}
                    onChange={(event) => updateDraft(setTone, event.target.value)}
                    className="w-full"
                  >
                    <option>Professional</option>
                    <option>Concise</option>
                    <option>Formal</option>
                  </SummonSelect>
                </SummonField>
                <SummonField label="Detail Level">
                  <SummonSelect
                    value={detailLevel}
                    onChange={(event) => updateDraft(setDetailLevel, event.target.value)}
                    className="w-full"
                  >
                    <option>Comprehensive</option>
                    <option>Standard</option>
                    <option>Summary</option>
                  </SummonSelect>
                </SummonField>
              </div>
            </div>
            <Button type="submit" disabled={!canGeneratePreview} loading={generating} className="w-full">
              <Sparkles className="mr-2 size-4" /> Generate Preview
            </Button>
            <p className="text-center text-[10px] text-tertiary">
              Files and Plane Pages require a second explicit action.
            </p>
            {formError ? (
              <div className="bg-red-50 text-red-600 grid gap-2 rounded-lg p-2.5 text-[11px]" role="alert">
                <span>{formError}</span>
                <Button type="button" size="sm" variant="neutral-primary" onClick={() => void generatePreview()}>
                  Retry preview
                </Button>
              </div>
            ) : null}
          </form>
        </section>

        <section className="overflow-hidden rounded-2xl border border-subtle bg-surface-1 shadow-[0_8px_30px_rgba(36,55,99,0.035)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle px-4 py-3.5">
            <h2 className="text-sm font-semibold text-primary">Generated Documents</h2>
            <button
              type="button"
              onClick={() => {
                setActiveType("all");
                setPage(1);
              }}
              className="inline-flex h-8 items-center gap-2 rounded-lg border border-subtle px-3 text-[11px] font-medium text-secondary"
            >
              <Filter className="size-3.5" /> Filters
            </button>
          </div>
          <div className="flex gap-5 overflow-x-auto border-b border-subtle px-4 pt-1">
            <button
              type="button"
              onClick={() => {
                setActiveType("all");
                setPage(1);
              }}
              className={`h-10 border-b-2 text-[11px] font-medium whitespace-nowrap ${
                activeType === "all" ? "border-accent-primary text-accent-primary" : "border-transparent text-secondary"
              }`}
            >
              All
            </button>
            {types.slice(0, 6).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setActiveType(type);
                  setPage(1);
                }}
                className={`h-10 border-b-2 text-[11px] font-medium whitespace-nowrap ${
                  activeType === type
                    ? "border-accent-primary text-accent-primary"
                    : "border-transparent text-secondary"
                }`}
              >
                {templateLabel(type)}
              </button>
            ))}
          </div>
          <SummonRequestState
            loading={isLoading}
            error={error}
            empty={!isLoading && filteredJobs.length === 0}
            onRetry={() => void mutate()}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead className="border-b border-subtle bg-layer-1/40 text-[10px] font-semibold text-tertiary">
                <tr>
                  <th className="px-4 py-3">Document</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Context</th>
                  <th className="px-3 py-3">Engine</th>
                  <th className="px-3 py-3">Created At</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {pagedJobs.map((job) => {
                  const status = jobStatus(job);
                  const { Icon, tone: iconTone } = templateVisual(job.type);
                  return (
                    <tr key={job.id} className="hover:bg-layer-1/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${iconTone}`}>
                            <Icon className="size-3.5" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs max-w-56 truncate font-medium text-primary">
                              {automationInputValue(job.input, "title") || templateLabel(job.type)}
                            </p>
                            <p className="mt-0.5 max-w-56 truncate text-[10px] text-tertiary">
                              {automationInputValue(job.input, "brief") || "Generated from verified workspace context"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="bg-blue-50 text-blue-600 rounded-md px-2 py-1 text-[10px] font-medium">
                          {templateLabel(job.type)}
                        </span>
                      </td>
                      <td className="max-w-48 truncate px-3 py-3 text-[11px] text-secondary">
                        {job.project ? (projectNames.get(job.project) ?? job.project) : "No project"}
                      </td>
                      <td className="px-3 py-3 text-[11px] text-secondary">{job.provider || "Pending"}</td>
                      <td className="px-3 py-3 text-[11px] whitespace-nowrap text-secondary">
                        {formatDate(job.created_at)}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium ${status.className}`}
                        >
                          {job.status === "completed" ? (
                            <Check className="size-3" />
                          ) : job.status === "failed" ? (
                            <CircleAlert className="size-3" />
                          ) : null}
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            aria-pressed={selectedJob?.id === job.id}
                            aria-label={`View ${automationInputValue(job.input, "title") || templateLabel(job.type)}`}
                            onClick={() => {
                              setActiveJob(job);
                              setDetailsOpen(true);
                            }}
                            className="grid size-8 place-items-center rounded-lg border border-subtle text-secondary"
                          >
                            <Eye className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="More document actions"
                            onClick={() => {
                              setActiveJob(job);
                              setDetailsOpen(true);
                            }}
                            className="grid size-8 place-items-center rounded-lg border border-subtle text-secondary"
                          >
                            <MoreHorizontal className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-subtle px-4 py-3">
            <p className="text-[10px] text-secondary">
              Showing {filteredJobs.length ? (currentPage - 1) * 8 + 1 : 0} to{" "}
              {Math.min(currentPage * 8, filteredJobs.length)} of {filteredJobs.length} documents
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Previous page"
                disabled={currentPage === 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="grid size-8 place-items-center rounded-lg border border-subtle text-secondary disabled:opacity-40"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <span className="grid size-8 place-items-center rounded-lg bg-accent-primary text-[11px] font-semibold text-white">
                {currentPage}
              </span>
              <span className="px-1 text-[10px] text-tertiary">/ {pageCount}</span>
              <button
                type="button"
                aria-label="Next page"
                disabled={currentPage === pageCount}
                onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                className="grid size-8 place-items-center rounded-lg border border-subtle text-secondary disabled:opacity-40"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>

          {detailsOpen && selectedJob ? (
            <div className="border-t border-subtle bg-layer-1/30 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-primary">{selectedJobTitle}</p>
                  <p className="mt-1 text-[10px] text-secondary">
                    {selectedJobProject} · {selectedJob.provider || selectedJob.error_summary || selectedJob.status}
                    {selectedJob.model ? ` · ${selectedJob.model}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="neutral-primary"
                    disabled={!hasValidPreview || Boolean(fileArtifacts.length)}
                    loading={rendering}
                    onClick={() => void generateFiles()}
                  >
                    Generate files
                  </Button>
                  <Button
                    size="sm"
                    disabled={!hasValidPreview || Boolean(pageArtifact)}
                    loading={publishing}
                    onClick={() => void publishPreview()}
                  >
                    Publish to Plane Page
                  </Button>
                  <button
                    type="button"
                    onClick={() => setDetailsOpen(false)}
                    className="text-[11px] font-medium text-secondary"
                  >
                    Close
                  </button>
                </div>
              </div>
              {previewDirty ? (
                <p className="text-amber-600 mt-3 text-[11px]" role="status">
                  Inputs changed. Generate a new preview before creating files or publishing.
                </p>
              ) : null}
              {renderError ? (
                <p className="text-red-600 mt-3 text-[11px]" role="alert">
                  {renderError}
                </p>
              ) : null}
              {selectedJob.context_truncated ? (
                <p className="bg-amber-50 text-amber-700 mt-3 rounded-lg px-3 py-2 text-[11px]">
                  Selected context was truncated to 30,000 characters.
                </p>
              ) : null}
              {selectedJob.preview_markdown ? (
                <pre className="mt-3 max-h-72 overflow-auto rounded-xl border border-subtle bg-surface-1 p-3 text-[11px] whitespace-pre-wrap text-primary">
                  {selectedJob.preview_markdown}
                </pre>
              ) : (
                <p className="mt-3 text-[11px] text-tertiary">No completed preview is available.</p>
              )}
              {fileArtifacts.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {fileArtifacts.map((artifact) =>
                    artifact.file_detail ? (
                      <a
                        key={artifact.id}
                        href={artifact.file_detail.href}
                        download={artifact.file_detail.name}
                        className="rounded-lg border border-subtle bg-surface-1 px-3 py-2 text-[11px] font-medium text-accent-primary"
                      >
                        Download {OUTPUT_FORMAT_LABELS[artifact.format]}
                      </a>
                    ) : null
                  )}
                </div>
              ) : null}
              {pageArtifact?.page_detail ? (
                <Link
                  href={pageArtifact.page_detail.href}
                  className="mt-3 inline-block text-[11px] font-semibold text-accent-primary"
                >
                  Open published Plane Page →
                </Link>
              ) : null}
              {selectedJob.citations.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedJob.citations.map((citation) => (
                    <Link
                      key={citation.id}
                      href={citation.href}
                      className="rounded-md bg-surface-1 px-2 py-1 text-[10px] text-accent-primary"
                    >
                      {citation.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <section id="template-library" className="rounded-2xl border border-subtle bg-surface-1 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-primary">Template Library</h2>
            <span className="text-xs font-medium text-accent-primary">{templates.length} templates</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {templates.slice(0, 4).map((item) => {
              const { Icon, tone: iconTone } = templateVisual(item.type);
              return (
                <a
                  key={item.id}
                  href="#automation-generator"
                  onClick={() => selectTemplate(item.id)}
                  className="rounded-xl border border-subtle p-3 hover:border-accent-strong"
                >
                  <div className="flex items-start gap-2.5">
                    <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${iconTone}`}>
                      <Icon className="size-3.5" />
                    </span>
                    <div>
                      <p className="text-[11px] font-semibold text-primary">{item.name}</p>
                      <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-secondary">
                        {item.description || templateLabel(item.type)}
                      </p>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </section>
        <section className="rounded-2xl border border-subtle bg-surface-1 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-primary">Recent Activity</h2>
            <History className="size-4 text-tertiary" />
          </div>
          <div className="mt-3 grid gap-3">
            {jobs.slice(0, 4).map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => {
                  setActiveJob(job);
                  setDetailsOpen(true);
                }}
                className="flex items-start gap-3 text-left"
              >
                <span
                  className={`mt-1 size-2 rounded-full ${
                    job.status === "completed"
                      ? "bg-emerald-500"
                      : job.status === "failed"
                        ? "bg-red-500"
                        : "bg-amber-500"
                  }`}
                />
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-medium text-primary">
                    {automationInputValue(job.input, "title") || templateLabel(job.type)}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-tertiary">
                    {formatDate(job.created_at)} · {jobStatus(job).label}
                  </span>
                </span>
              </button>
            ))}
            {!jobs.length && !isLoading ? (
              <p className="text-[11px] text-tertiary">No generation activity yet.</p>
            ) : null}
          </div>
        </section>
      </div>
    </section>
  );
}
