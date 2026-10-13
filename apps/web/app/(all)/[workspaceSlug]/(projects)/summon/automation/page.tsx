/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenIcon, FileTextIcon, PresentationIcon, SquaresFourIcon, TableIcon } from "@phosphor-icons/react";
import useSWR from "swr";
import {
  ArrowRight,
  BookOpen,
  Check,
  CircleAlert,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  MoreHorizontal,
  Presentation,
  Settings,
  Sparkles,
} from "lucide-react";
import { Button, getButtonStyling } from "@plane/propel/button";
import { Input, TextArea } from "@plane/ui";
import { EFileAssetType } from "@plane/types";
import type { ISummonAutomationJob, ISummonAutomationTemplate, ISummonGeneratedArtifact } from "@plane/types";
import { PageHead } from "@/components/core/page-title";
import { SummonField } from "@/components/summon/forms";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonDrawer } from "@/components/summon/drawer";
import { SectionTabs } from "@/components/summon/section-tabs";
import type { TSelectableIcon } from "@plane/propel/icons";
import {
  SummonPageHeader,
  SummonPagination,
  summonLLMErrorMessage,
  summonPageClassName,
  ViewPanel,
  SummonPanel,
  SummonSectionHeader,
} from "@/components/summon/screen";
import { useHashTab } from "@/components/summon/use-hash-tab";
import { useProject } from "@/hooks/store/use-project";
import { FileService } from "@/services/file.service";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";
import {
  automationInputValue,
  automationJobPath,
  buildAutomationInput,
  filterAutomationJobs,
  isMultilineTemplateVariable,
  meetingTranscriptReady,
  syncTemplateVariableValues,
  templateVariableLabel,
  templateVariableNames,
} from "./automation-form";
import { MultiSelect, Select } from "@plane/propel/select";
import { SummonSearchField } from "@/components/summon/search-field";

const fileService = new FileService();

const OUTPUT_FORMAT_LABELS: Record<ISummonGeneratedArtifact["format"], string> = {
  page: "Page",
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

const templateTabIcon = (type: string): TSelectableIcon => {
  if (type === "quotation" || type === "cost_projection") return TableIcon;
  if (type.startsWith("mom_")) return BookOpenIcon;
  if (type === "presentation") return PresentationIcon;
  return FileTextIcon;
};

const templateVisual = (type: string) => {
  if (type === "quotation") return { Icon: FileSpreadsheet, tone: "bg-label-emerald-bg text-label-emerald-icon" };
  if (type.startsWith("mom_")) return { Icon: BookOpen, tone: "bg-label-purple-bg text-label-purple-icon" };
  if (type === "presentation") return { Icon: Presentation, tone: "bg-label-orange-bg text-label-orange-icon" };
  if (type === "cost_projection") return { Icon: FileSpreadsheet, tone: "bg-label-yellow-bg text-label-yellow-icon" };
  if (type.includes("proposal")) return { Icon: FileText, tone: "bg-label-indigo-bg text-label-indigo-icon" };
  return { Icon: FileCheck2, tone: "bg-label-grey-bg text-label-grey-icon" };
};

const outputFormats = (type?: string) => {
  if (["presentation", "proposal_vendor", "proposal_client"].includes(type ?? "")) return ["pptx", "pdf"] as const;
  if (["usage_cost", "cost_projection", "timeline", "bug_report"].includes(type ?? "")) return ["xlsx", "pdf"] as const;
  return ["docx", "pdf"] as const;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));

const jobStatus = (job: ISummonAutomationJob) => {
  if (job.status === "completed")
    return {
      label: job.artifacts.length ? "Completed" : "Preview",
      className: "bg-success-subtle text-success-primary",
    };
  if (job.status === "failed") return { label: "Failed", className: "bg-danger-subtle text-danger-primary" };
  return {
    label: job.status === "running" ? "Running" : "Queued",
    className: "bg-warning-subtle text-warning-primary",
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
  const router = useRouter();
  const { joinedProjectIds, getProjectById } = useProject();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [template, setTemplate] = useState("");
  const [generatorOpen, setGeneratorOpen] = useState(false);
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
  const [generating, setGenerating] = useState(false);
  const [extractingDocument, setExtractingDocument] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [documentName, setDocumentName] = useState("");
  const [formError, setFormError] = useState("");
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const { data, error, isLoading, mutate } = useSWR(
    ["summon-automation", workspaceSlug],
    async () => {
      const [templates, jobs, clients, meetings, pages] = await Promise.all([
        summonService.listAutomationTemplates(workspaceSlug),
        summonService.listAutomationJobs(workspaceSlug),
        summonService.listClients(workspaceSlug),
        summonService.listMeetings(workspaceSlug),
        summonService.listPageContexts(workspaceSlug),
      ]);
      return { templates, jobs, clients, meetings, pages };
    },
    {
      refreshInterval: (current) =>
        current?.meetings.find(({ id }) => id === meetingId)?.summary_error === "transcribing" ? 3000 : 0,
    }
  );
  const jobs = useMemo(() => data?.jobs ?? [], [data?.jobs]);
  const templates = useMemo(() => orderedTemplates(data?.templates ?? []), [data?.templates]);
  const selectedTemplate = templates.find(({ id }) => id === template);
  const selectedMeeting = data?.meetings.find(({ id }) => id === meetingId);
  const templateVariables = templateVariableNames(selectedTemplate?.variables ?? []);
  const projectNames = useMemo(
    () => new Map(joinedProjectIds.map((id) => [id, getProjectById(id)?.name ?? id])),
    [getProjectById, joinedProjectIds]
  );
  const typeTabs = useMemo(() => {
    const types = Array.from(new Set([...templates.map(({ type }) => type), ...jobs.map(({ type }) => type)]));
    return [
      { value: "all", label: "All", icon: SquaresFourIcon },
      ...types.slice(0, 6).map((type) => ({ value: type, label: templateLabel(type), icon: templateTabIcon(type) })),
    ];
  }, [jobs, templates]);
  const [activeType, selectType] = useHashTab(typeTabs.map((tab) => tab.value));
  const filteredJobs = useMemo(
    () => filterAutomationJobs(jobs, projectNames, query, activeType),
    [activeType, jobs, projectNames, query]
  );
  const pageCount = Math.max(1, Math.ceil(filteredJobs.length / 8));
  const currentPage = Math.min(page, pageCount);
  const pagedJobs = filteredJobs.slice((currentPage - 1) * 8, currentPage * 8);
  const canGeneratePreview = Boolean(
    template && outputProject && title.trim() && meetingTranscriptReady(selectedMeeting)
  );

  const openGenerator = (templateId?: string) => {
    if (templateId) selectTemplate(templateId);
    setGeneratorOpen(true);
  };

  const selectTemplate = (templateId: string) => {
    const item = templates.find(({ id }) => id === templateId);
    setTemplate(templateId);
    setVariableValues((current) => syncTemplateVariableValues(item?.variables ?? [], current));
    if (!title.trim() && item) setTitle(item.name);
  };

  const selectProject = (value: string) => {
    setOutputProject(value);
    setProjectId(value);
  };

  const updateVariable = (variable: string, value: string) => {
    setVariableValues((current) => ({ ...current, [variable]: value }));
  };

  const extractDocument = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setExtractingDocument(true);
    setFormError("");
    try {
      const extracted = await summonService.extractAutomationContext(workspaceSlug, file);
      setBrief([brief.trim(), `[Document: ${extracted.name}]\n${extracted.text}`].filter(Boolean).join("\n\n"));
      setDocumentName(`${extracted.name}${extracted.truncated ? " (trimmed to 30,000 characters)" : ""}`);
    } catch (requestError) {
      setFormError(summonLLMErrorMessage(requestError));
    } finally {
      setExtractingDocument(false);
    }
  };

  const uploadMeetingAudio = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !meetingId) return;
    setUploadingAudio(true);
    setFormError("");
    let assetId = "";
    try {
      const asset = await fileService.uploadWorkspaceAsset(
        workspaceSlug,
        { entity_identifier: meetingId, entity_type: EFileAssetType.MEETING_RECORDING },
        file
      );
      assetId = asset.asset_id;
      await summonService.updateMeeting(workspaceSlug, meetingId, { recording_asset: assetId });
      await mutate();
    } catch (requestError) {
      if (assetId) await fileService.deleteWorkspaceAsset(workspaceSlug, assetId).catch(() => undefined);
      setFormError(summonLLMErrorMessage(requestError));
    } finally {
      setUploadingAudio(false);
    }
  };

  const generatePreview = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!canGeneratePreview) return;
    setGenerating(true);
    setFormError("");
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
      await mutate();
      router.push(automationJobPath(workspaceSlug, job.id));
    } catch (requestError) {
      setFormError(summonLLMErrorMessage(requestError));
      await mutate();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className={summonPageClassName}>
      <PageHead title="Automation Studio · Summon Core" />
      <SummonPageHeader
        title="Automation Studio"
        description="Generate documents and automate routine work"
        actions={
          <>
            <SummonSearchField
              label="Search templates and documents"
              placeholder="Search"
              value={query}
              onValueChange={setQuery}
              className="w-full sm:w-80"
            />
            <Link href={`/${workspaceSlug}/summon/knowledge/`} className={getButtonStyling("secondary", "lg")}>
              <BookOpen />
              Knowledge
            </Link>
            <Link href={`/${workspaceSlug}/summon/settings/`} className={getButtonStyling("secondary", "lg")}>
              <Settings />
              Settings
            </Link>
            <Button size="lg" onClick={() => openGenerator()}>
              <Sparkles />
              New document
            </Button>
          </>
        }
      />

      <section className="mt-8">
        <SummonSectionHeader title="Templates" count={templates.length} className="mb-3" />
        <SummonRequestState
          loading={isLoading}
          error={error}
          empty={!isLoading && templates.length === 0}
          emptyAsset="automation"
          emptyTitle="No templates yet"
          emptyMessage="Document templates you can generate from show up here."
          onRetry={() => void mutate()}
        />
        <div className="grid gap-2 sm:grid-cols-2 sm:gap-2.5 lg:grid-cols-3 xl:grid-cols-4">
          {templates.map((item) => {
            const { Icon, tone: iconTone } = templateVisual(item.type);
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => openGenerator(item.id)}
                className={`group flex items-center gap-3 rounded-xl border bg-surface-1 p-3 text-left transition-colors hover:border-accent-strong sm:p-4 ${
                  template === item.id ? "border-accent-strong ring-1 ring-accent-subtle" : "border-subtle"
                }`}
              >
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${iconTone}`}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p title={item.name} className="truncate text-13 font-semibold text-primary">
                    {item.name}
                  </p>
                  <p className="mt-0.5 hidden truncate text-12 text-secondary sm:block">
                    {item.description ||
                      `Generate ${templateLabel(item.type).toLowerCase()} from verified workspace context.`}
                  </p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-tertiary transition-transform group-hover:translate-x-0.5" />
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-4">
        <SummonPanel flush title="Generated documents" count={filteredJobs.length}>
          <SectionTabs
            items={typeTabs}
            value={activeType}
            onValueChange={(type) => {
              selectType(type);
              setPage(1);
            }}
            label="Generated document types"
            className="px-4"
          />
          <ViewPanel value={activeType}>
            <SummonRequestState
              loading={isLoading}
              error={error}
              empty={!isLoading && filteredJobs.length === 0}
              emptyAsset="automation"
              emptyTitle="No generated documents yet"
              emptyMessage="Pick a template above to generate your first document."
              onRetry={() => void mutate()}
            />
            {filteredJobs.length > 0 && (
              <>
                <div className="overflow-x-auto">
                  <table className="table-stack w-full text-left md:min-w-[820px]">
                    <thead className="border-b border-subtle bg-layer-1/40 text-12 font-semibold text-tertiary">
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
                                  <p className="max-w-56 truncate text-xs font-medium text-primary">
                                    {automationInputValue(job.input, "title") || templateLabel(job.type)}
                                  </p>
                                  <p className="mt-0.5 max-w-56 truncate text-12 text-tertiary">
                                    {automationInputValue(job.input, "brief") ||
                                      "Generated from verified workspace context"}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td data-label="Type" className="px-3 py-3">
                              <span className="rounded-md bg-accent-subtle px-2 py-1 text-12 font-medium text-accent-primary">
                                {templateLabel(job.type)}
                              </span>
                            </td>
                            <td data-label="Context" className="truncate px-3 py-3 text-12 text-secondary md:max-w-48">
                              {job.project ? (projectNames.get(job.project) ?? job.project) : "No project"}
                            </td>
                            <td data-label="Engine" className="px-3 py-3 text-12 text-secondary">
                              {job.provider || "Pending"}
                            </td>
                            <td data-label="Created" className="px-3 py-3 text-12 whitespace-nowrap text-secondary">
                              {formatDate(job.created_at)}
                            </td>
                            <td data-label="Status" className="px-3 py-3">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-12 font-medium ${status.className}`}
                              >
                                {job.status === "completed" ? (
                                  <Check className="size-3" />
                                ) : job.status === "failed" ? (
                                  <CircleAlert className="size-3" />
                                ) : null}
                                {status.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 max-md:justify-end max-md:pt-2">
                              <div className="flex justify-end gap-1.5">
                                <Link
                                  href={automationJobPath(workspaceSlug, job.id)}
                                  aria-label={`View ${automationInputValue(job.input, "title") || templateLabel(job.type)}`}
                                  className="grid size-8 place-items-center rounded-lg border border-subtle text-secondary"
                                >
                                  <Eye className="size-3.5" />
                                </Link>
                                <Link
                                  href={automationJobPath(workspaceSlug, job.id)}
                                  aria-label="More document actions"
                                  className="grid size-8 place-items-center rounded-lg border border-subtle text-secondary"
                                >
                                  <MoreHorizontal className="size-3.5" />
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <SummonPagination
                  page={currentPage}
                  pageSize={8}
                  total={filteredJobs.length}
                  noun="documents"
                  onPageChange={setPage}
                />
              </>
            )}
          </ViewPanel>
        </SummonPanel>
      </div>

      <SummonDrawer
        open={generatorOpen}
        onOpenChange={setGeneratorOpen}
        title="Generate a document"
        description="Preview first; files and pages are created only when you publish."
      >
        <form onSubmit={generatePreview} className="grid gap-4">
          <div className="relative pl-7">
            <span className="absolute top-0 left-0 grid size-5 place-items-center rounded-full bg-accent-primary text-12 font-semibold text-white">
              1
            </span>
            <SummonField label="Select Template">
              <Select
                required
                value={template}
                onValueChange={(value) => selectTemplate(value)}
                options={[
                  { value: "", label: "Select template" },
                  ...(data?.templates ?? []).map((item) => ({ value: item.id, label: item.name })),
                ]}
              />
            </SummonField>
          </div>
          <div className="relative pl-7">
            <span className="absolute top-0 left-0 grid size-5 place-items-center rounded-full bg-accent-primary text-12 font-semibold text-white">
              2
            </span>
            <SummonField label="Select Project Context">
              <Select
                required
                value={outputProject}
                onValueChange={(value) => selectProject(value)}
                options={[
                  { value: "", label: "Select project" },
                  ...joinedProjectIds.map((id) => ({ value: id, label: getProjectById(id)?.name ?? id })),
                ]}
              />
            </SummonField>
          </div>
          <div className="relative grid gap-2.5 pl-7">
            <span className="absolute top-0 left-0 grid size-5 place-items-center rounded-full bg-accent-primary text-12 font-semibold text-white">
              3
            </span>
            <SummonField label="Document Title">
              <Input
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Name this document"
              />
            </SummonField>
            <SummonField label="Additional Context (Optional)">
              <TextArea
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                placeholder="Add project, scope, or client-specific requirements…"
                className="min-h-20"
              />
            </SummonField>
            <SummonField label="Upload context document (Optional)">
              <input
                type="file"
                accept=".pdf,.docx,.xlsx,.pptx,.txt,.md,.csv"
                disabled={extractingDocument}
                onChange={(event) => void extractDocument(event)}
                className="block w-full rounded-lg border border-subtle bg-surface-1 p-2 text-xs text-secondary file:mr-2 file:rounded-md file:border-0 file:bg-layer-2 file:px-2 file:py-1 file:text-primary"
              />
              <span className="mt-1 block text-12 text-tertiary">
                {extractingDocument
                  ? "Reading document…"
                  : documentName || "PDF, DOCX, XLSX, PPTX, TXT, MD, CSV · max 10 MB"}
              </span>
            </SummonField>
            <SummonField label="Meeting / audio transcript (Optional)">
              <Select
                value={meetingId}
                onValueChange={(value) => setMeetingId(value)}
                options={[
                  { value: "", label: "No meeting source" },
                  ...(data?.meetings ?? []).map((meeting) => ({ value: meeting.id, label: meeting.title })),
                ]}
              />
              <input
                type="file"
                accept=".mp3,.m4a,audio/mpeg,audio/mp4,audio/x-m4a"
                disabled={!meetingId || uploadingAudio}
                onChange={(event) => void uploadMeetingAudio(event)}
                className="mt-2 block w-full rounded-lg border border-subtle bg-surface-1 p-2 text-xs text-secondary file:mr-2 file:rounded-md file:border-0 file:bg-layer-2 file:px-2 file:py-1 file:text-primary"
              />
              <span className="mt-1 block text-12 text-tertiary">
                {uploadingAudio
                  ? "Uploading audio…"
                  : selectedMeeting?.summary_error === "transcribing"
                    ? "Transcribing audio…"
                    : selectedMeeting?.summary_error === "transcription_failed"
                      ? "Transcription failed. Upload the MP3 or M4A again."
                      : selectedMeeting?.transcript_text
                        ? "Transcript siap digunakan."
                        : "Pick a meeting, then upload an MP3 or M4A · max 250 MB"}
              </span>
            </SummonField>
            {templateVariables.length ? (
              <details className="rounded-xl border border-subtle bg-layer-1/40 p-2.5" open>
                <summary className="cursor-pointer text-12 font-semibold text-primary">
                  Document fields (Optional)
                </summary>
                <div className="mt-3 grid gap-2.5">
                  {templateVariables.map((variable) => (
                    <SummonField key={variable} label={templateVariableLabel(variable)}>
                      {isMultilineTemplateVariable(variable) ? (
                        <TextArea
                          value={variableValues[variable] ?? ""}
                          onChange={(event) => updateVariable(variable, event.target.value)}
                          placeholder="Enter one item per line or structured details"
                          className="min-h-16"
                        />
                      ) : (
                        <Input
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
              <summary className="cursor-pointer text-12 font-semibold text-primary">More verified context</summary>
              <div className="mt-3 grid gap-2.5">
                <SummonField label="Client">
                  <Select
                    value={clientId}
                    onValueChange={(value) => setClientId(value)}
                    options={[
                      { value: "", label: "No client source" },
                      ...(data?.clients ?? []).map((client) => ({ value: client.id, label: client.name })),
                    ]}
                  />
                </SummonField>
                <SummonField label="Documents">
                  <MultiSelect
                    value={pageIds}
                    onValueChange={(values) => setPageIds(values)}
                    options={(data?.pages ?? []).map((item) => ({ value: item.page, label: item.page_detail.name }))}
                  />
                </SummonField>
                <label className="inline-flex items-center gap-2 text-12 font-medium text-secondary">
                  <input
                    type="checkbox"
                    checked={workspaceContext}
                    onChange={(event) => setWorkspaceContext(event.target.checked)}
                    className="accent-accent-primary size-4"
                  />
                  Include workspace name
                </label>
              </div>
            </details>
          </div>
          <div className="relative pl-7">
            <span className="absolute top-0 left-0 grid size-5 place-items-center rounded-full bg-accent-primary text-12 font-semibold text-white">
              4
            </span>
            <p className="text-xs font-medium text-secondary">Output Preferences</p>
            <div className="mt-2 flex gap-2">
              {outputFormats(selectedTemplate?.type).map((format) => (
                <span
                  key={format}
                  className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-accent-strong bg-accent-subtle/20 text-12 font-semibold text-accent-primary"
                >
                  <FileText className="size-3.5" /> {OUTPUT_FORMAT_LABELS[format]}
                </span>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <SummonField label="Tone">
                <Select
                  value={tone}
                  onValueChange={(value) => setTone(value)}
                  options={[
                    { value: "Professional", label: "Professional" },
                    { value: "Concise", label: "Concise" },
                    { value: "Formal", label: "Formal" },
                  ]}
                />
              </SummonField>
              <SummonField label="Detail Level">
                <Select
                  value={detailLevel}
                  onValueChange={(value) => setDetailLevel(value)}
                  options={[
                    { value: "Comprehensive", label: "Comprehensive" },
                    { value: "Standard", label: "Standard" },
                    { value: "Summary", label: "Summary" },
                  ]}
                />
              </SummonField>
            </div>
          </div>
          <Button size="xl" type="submit" disabled={!canGeneratePreview} loading={generating} className="w-full">
            <Sparkles className="mr-2 size-4" /> Generate Preview
          </Button>
          {formError ? (
            <div className="grid gap-2 rounded-lg bg-danger-subtle p-2.5 text-12 text-danger-primary" role="alert">
              <span>{formError}</span>
              <Button type="button" size="lg" variant="secondary" onClick={() => void generatePreview()}>
                Retry preview
              </Button>
            </div>
          ) : null}
        </form>
      </SummonDrawer>
    </section>
  );
}
