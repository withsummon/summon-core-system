import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import { useStickiesCommands } from "@/components/stickies/native/provider";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction, useMutation, useQuery, usePaginatedQuery } from "convex/react";
import { useOutletContext, useSearchParams } from "react-router";
import { api } from "@summon/convex/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { Doc } from "@summon/convex/data-model";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { uploadFileAsset } from "@/components/convex-core/assets/upload-file";
import { selectedAssociation } from "@/components/convex-core/resources/associations";
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
import { Button } from "@plane/propel/button";
import { Input, TextArea } from "@plane/ui";

import { PageHead } from "@/components/core/page-title";
import { SummonField } from "@/components/summon/forms";
import { SummonRequestState } from "@/components/summon/request-state";
import { summonLLMErrorMessage } from "@/components/summon/screen";

import {
  automationJobPath,
  buildAutomationInput,
  isMultilineTemplateVariable,
  syncTemplateVariableValues,
  templateVariableLabel,
  templateVariableNames,
} from "./automation-form";
import { MultiSelect, Select } from "@plane/propel/select";

const OUTPUT_FORMAT_LABELS: Record<"page" | NonNullable<Doc<"automationJobs">["artifacts"]>[number]["format"], string> =
  {
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
    .replace(/^proposal_(client|vendor)$/, "$1 proposal")
    .replace(/^mom_(iglo|summon)$/, "minutes of meeting ($1)")
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
  if (["presentation", "proposal_vendor", "proposal_client"].includes(type ?? "")) return ["pptx", "pdf"] as const;
  if (["usage_cost", "cost_projection", "timeline", "bug_report"].includes(type ?? "")) return ["xlsx", "pdf"] as const;
  return ["docx", "pdf"] as const;
};

const formatDate = (value: number) =>
  new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));

const jobStatus = (job: Doc<"automationJobs">) => {
  if (job.status === "completed")
    return {
      label: job.artifacts?.length ? "Completed" : "Preview",
      className: "bg-emerald-50 text-emerald-700",
    };
  if (job.status === "failed") return { label: "Failed", className: "bg-red-50 text-red-600" };
  return {
    label: job.status === "running" ? "Running" : "Queued",
    className: "bg-amber-50 text-amber-700",
  };
};

const orderedTemplates = (templates: Doc<"automationTemplates">[]) =>
  // eslint-disable-next-line unicorn/no-array-sort -- the app target does not include ES2023 Array#toSorted.
  [...templates].sort((left, right) => {
    const leftIndex = templateOrder.indexOf(left.type);
    const rightIndex = templateOrder.indexOf(right.type);
    return (
      (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex) || left.name.localeCompare(right.name)
    );
  });

export default function SummonAutomationPage() {
  const session = useOutletContext<WorkspaceSession>();
  const { workspace } = session;
  const workspaceSlug = workspace.slug;
  const [searchParams, setSearchParams] = useSearchParams();
  const opportunityId = searchParams.get("opportunity");
  const opportunity = useQuery(
    api.commercial.opportunities.get,
    opportunityId ? { workspaceId: workspace._id, opportunityId, clientId: null } : "skip"
  );
  const commands = useStickiesCommands();
  const [installError, setInstallError] = useState("");
  const installDefaults = useMutation(api.automation.templates.installDefaults);
  const projects = useQuery(api.projects.index.list, { workspaceId: workspace._id }) ?? [];
  const templateList = usePaginatedQuery(
    api.automation.templates.list,
    { workspaceId: workspace._id },
    { initialNumItems: 100 }
  );
  const jobList = usePaginatedQuery(api.automation.jobs.list, { workspaceId: workspace._id }, { initialNumItems: 100 });
  const { status: templateListStatus, loadMore: loadTemplatelist } = templateList;
  useEffect(() => {
    if (templateListStatus === "CanLoadMore") loadTemplatelist(100);
  }, [templateListStatus, loadTemplatelist]);
  const { status: jobListStatus, loadMore: loadJoblist } = jobList;
  useEffect(() => {
    if (jobListStatus === "CanLoadMore") loadJoblist(100);
  }, [jobListStatus, loadJoblist]);
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState("all");
  const [page, setPage] = useState(1);
  const isLoading = templateList.status !== "Exhausted" || jobList.status !== "Exhausted";
  const jobs = jobList.results;
  const templates = useMemo(() => orderedTemplates(templateList.results), [templateList.results]);
  const projectNames = new Map(projects.map((row) => [row._id, row.name]));
  const filteredJobs = jobs.filter(
    (job) =>
      (activeType === "all" || job.template.type === activeType) &&
      [job.title, job.template.type, projectNames.get(job.projectId)].some((value) =>
        value?.toLowerCase().includes(query.trim().toLowerCase())
      )
  );
  const pageCount = Math.max(1, Math.ceil(filteredJobs.length / 8));
  const currentPage = Math.min(page, pageCount);
  const pagedJobs = filteredJobs.slice((currentPage - 1) * 8, currentPage * 8);
  const types = useMemo(
    () => Array.from(new Set([...templates.map(({ type }) => type), ...jobs.map((job) => job.template.type)])),
    [jobs, templates]
  );
  const template =
    searchParams.get("template") ??
    templates.find((item) => item.isActive && item.type === searchParams.get("templateType"))?._id ??
    "";
  const selectTemplate = (templateId: string) =>
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("template", templateId);
      return next;
    });

  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
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
          <SummonRequestState loading={isLoading} empty={!isLoading && templates.length === 0} />
          {installError && (
            <p role="alert" className="text-sm text-danger-primary">
              {installError}
            </p>
          )}
          {!isLoading && templates.length === 0 && workspace.membershipRole === "admin" && (
            <button
              type="button"
              onClick={() => {
                void installDefaults({ workspaceId: workspace._id }).catch((error) =>
                  setInstallError(summonLLMErrorMessage(error))
                );
              }}
              className="text-sm mb-3 rounded-xl border border-subtle px-3 py-2"
            >
              Install document templates
            </button>
          )}
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-6">
            {templates.slice(0, 6).map((item) => {
              const { Icon, tone: iconTone } = templateVisual(item.type);
              return (
                <a
                  key={item._id}
                  href="#automation-generator"
                  onClick={() => selectTemplate(item._id)}
                  className={`group flex min-h-28 flex-col rounded-2xl border bg-surface-1 p-4 transition-colors hover:border-accent-strong ${
                    template === item._id ? "ring-accent-primary/20 border-accent-strong ring-1" : "border-subtle"
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
          {opportunityId && opportunity === undefined ? (
            <SummonRequestState loading />
          ) : (
            <AutomationGenerator
              key={opportunity?.record?._id ?? "new"}
              workspace={workspace}
              workspaceSlug={workspaceSlug}
              projects={projects}
              template={template}
              templates={templates}
              opportunity={opportunity?.record ?? null}
              onTemplateChange={selectTemplate}
            />
          )}

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
                  activeType === "all"
                    ? "border-accent-primary text-accent-primary"
                    : "border-transparent text-secondary"
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
            <SummonRequestState loading={isLoading} empty={!isLoading && filteredJobs.length === 0} />
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
                    const { Icon, tone: iconTone } = templateVisual(job.template.type);
                    return (
                      <tr key={job._id} className="hover:bg-layer-1/40">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${iconTone}`}>
                              <Icon className="size-3.5" />
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs max-w-56 truncate font-medium text-primary">{job.title}</p>
                              <p className="mt-0.5 max-w-56 truncate text-[10px] text-tertiary">
                                {job.input.brief || "Generated from verified workspace context"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className="bg-blue-50 text-blue-600 rounded-md px-2 py-1 text-[10px] font-medium">
                            {templateLabel(job.template.type)}
                          </span>
                        </td>
                        <td className="max-w-48 truncate px-3 py-3 text-[11px] text-secondary">
                          {job.projectId ? (projectNames.get(job.projectId) ?? job.projectId) : "No project"}
                        </td>
                        <td className="px-3 py-3 text-[11px] text-secondary">{job.provider || "Pending"}</td>
                        <td className="px-3 py-3 text-[11px] whitespace-nowrap text-secondary">
                          {formatDate(job._creationTime)}
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
                            <Link
                              href={automationJobPath(workspaceSlug, job._id)}
                              aria-label={`View ${job.title}`}
                              className="grid size-8 place-items-center rounded-lg border border-subtle text-secondary"
                            >
                              <Eye className="size-3.5" />
                            </Link>
                            <Link
                              href={automationJobPath(workspaceSlug, job._id)}
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
                    key={item._id}
                    href="#automation-generator"
                    onClick={() => selectTemplate(item._id)}
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
                <Link
                  key={job._id}
                  href={automationJobPath(workspaceSlug, job._id)}
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
                    <span className="block truncate text-[11px] font-medium text-primary">{job.title}</span>
                    <span className="mt-0.5 block text-[10px] text-tertiary">
                      {formatDate(job._creationTime)} · {jobStatus(job).label}
                    </span>
                  </span>
                </Link>
              ))}
              {!jobs.length && !isLoading ? (
                <p className="text-[11px] text-tertiary">No generation activity yet.</p>
              ) : null}
            </div>
          </section>
        </div>
      </section>
    </PreservedWorkspaceShell>
  );
}

function AutomationGenerator({
  workspace,
  workspaceSlug,
  projects,
  template,
  templates,
  opportunity,
  onTemplateChange,
}: {
  workspace: WorkspaceSession["workspace"];
  workspaceSlug: string;
  projects: FunctionReturnType<typeof api.projects.index.list>;
  template: string;
  templates: Doc<"automationTemplates">[];
  opportunity: FunctionReturnType<typeof api.commercial.opportunities.get>["record"];
  onTemplateChange: (id: string) => void;
}) {
  const router = useRouter();
  const clientList = usePaginatedQuery(
    api.commercial.clients.list,
    { workspaceId: workspace._id },
    { initialNumItems: 100 }
  );
  const meetingList = usePaginatedQuery(
    api.meetings.index.list,
    { workspaceId: workspace._id },
    { initialNumItems: 100 }
  );
  const documentList = usePaginatedQuery(
    api.documents.index.list,
    { workspaceId: workspace._id },
    { initialNumItems: 100 }
  );
  const generate = useAction(api.automation.generate.preview);
  const options = useQuery(api.automation.templates.options, { workspaceId: workspace._id });
  const extract = useAction(api.automation.generate.extract);
  const prepare = useMutation(api.assets.index.prepare);
  const finalize = useAction(api.assets.upload.finalize);
  const filePolicy = useQuery(api.assets.index.policy, {});
  const removeAsset = useMutation(api.assets.index.remove);
  const prepareRecording = useMutation(api.assets.meetingRecordings.prepare);
  const discardRecording = useMutation(api.assets.meetingRecordings.discard);
  const startTranscription = useMutation(api.meetings.transcription.runs.start);
  const request = useRef<{ signature: string; requestId: string } | null>(null);
  const { status: clientListStatus, loadMore: loadClientlist } = clientList;
  useEffect(() => {
    if (clientListStatus === "CanLoadMore") loadClientlist(100);
  }, [clientListStatus, loadClientlist]);
  const { status: meetingListStatus, loadMore: loadMeetinglist } = meetingList;
  useEffect(() => {
    if (meetingListStatus === "CanLoadMore") loadMeetinglist(100);
  }, [meetingListStatus, loadMeetinglist]);
  const { status: documentListStatus, loadMore: loadDocumentlist } = documentList;
  useEffect(() => {
    if (documentListStatus === "CanLoadMore") loadDocumentlist(100);
  }, [documentListStatus, loadDocumentlist]);
  const [outputProject, setOutputProject] = useState("");
  const [enteredTitle, setTitle] = useState<string | null>(opportunity?.title ?? null);
  const title = enteredTitle ?? templates.find((item) => item._id === template)?.name ?? "";
  const [brief, setBrief] = useState(opportunity?.description ?? "");
  const [preferences, setPreferences] = useState<
    NonNullable<FunctionArgs<typeof api.automation.generate.preview>["preferences"]>
  >({ tone: "Professional", detailLevel: "Comprehensive" });
  const [workspaceContext, setWorkspaceContext] = useState(false);
  const [clientId, setClientId] = useState<string>(opportunity?.clientId ?? "");
  const [meetingId, setMeetingId] = useState("");
  const [pageIds, setPageIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [extractingDocument, setExtractingDocument] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [documentName, setDocumentName] = useState("");
  const [formError, setFormError] = useState("");
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const selectedTemplate = templates.find(({ _id }) => _id === template);
  const selectedMeeting = meetingList.results.find(({ _id }) => _id === meetingId);
  const meetingScope = selectedMeeting ? { workspaceId: workspace._id, meetingId: selectedMeeting._id } : null;
  const meetingArgs = meetingScope ?? "skip";
  const transcript = useQuery(api.meetings.summary.transcripts.get, meetingArgs);
  const transcription = useQuery(api.meetings.transcription.runs.latest, meetingArgs);
  const recordingPolicy = useQuery(api.assets.meetingRecordings.policy, meetingArgs);
  const templateVariables = templateVariableNames(selectedTemplate?.variables ?? []);
  const canGeneratePreview = [
    template,
    outputProject,
    title.trim(),
    options,
    !selectedMeeting || transcript?.canGenerateDocument,
  ].every(Boolean);

  const selectTemplate = (templateId: string) => {
    const item = templates.find(({ _id }) => _id === templateId);
    onTemplateChange(templateId);
    setVariableValues((current) => syncTemplateVariableValues(item?.variables ?? [], current));
    if (!title.trim() && item) setTitle(item.name);
  };

  const selectProject = (value: string) => {
    setOutputProject(value);
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
      if (!filePolicy) throw new Error("Upload policy is still loading.");
      let assetId: Doc<"assets">["_id"] | null = null;
      let extracted;
      try {
        assetId = await uploadFileAsset(
          file,
          filePolicy,
          (metadata) => prepare({ workspaceId: workspace._id, projectId: null, documentId: null, ...metadata }),
          finalize,
          new AbortController().signal
        );
        extracted = await extract({ assetId });
      } finally {
        if (assetId) await removeAsset({ assetId });
      }
      setBrief([brief.trim(), `[Document: ${extracted.name}]\n${extracted.text}`].filter(Boolean).join("\n\n"));
      setDocumentName(`${extracted.name}${extracted.truncated ? " (context dibatasi 30.000 karakter)" : ""}`);
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
    let assetId: Doc<"assets">["_id"] | null = null;
    try {
      if (!meetingScope || !transcript?.available || !transcript.canReplaceSource || !recordingPolicy)
        throw new Error("Meeting write access and a destination project are required.");
      const recordingAssetId = await uploadFileAsset(
        file,
        recordingPolicy,
        async (metadata) => {
          const ticket = await prepareRecording({ ...meetingScope, ...metadata });
          assetId = ticket.assetId;
          return ticket;
        },
        finalize,
        new AbortController().signal
      );
      await startTranscription({
        ...meetingScope,
        recordingAssetId,
        requestId: crypto.randomUUID(),
        expectedMeetingUpdatedAt: transcript.meetingUpdatedAt,
        expectedTranscriptRevision: transcript.transcriptRevision,
        expectedDocumentRevision: transcript.documentRevision,
        expectedDocumentUpdatedAt: transcript.documentUpdatedAt,
      });
    } catch (requestError) {
      setFormError(summonLLMErrorMessage(requestError));
      if (assetId) {
        try {
          await discardRecording({ assetId });
        } catch (cleanupError) {
          setFormError(`${summonLLMErrorMessage(requestError)} ${summonLLMErrorMessage(cleanupError)}`);
        }
      }
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
      if (!selectedTemplate) throw new Error("Choose an available template.");
      const destination = selectedAssociation(
        outputProject,
        projects.map((row) => ({ id: row._id }))
      );
      if (!destination) throw new Error("Choose a destination project.");
      const input = buildAutomationInput(selectedTemplate.variables, title, brief, variableValues);
      const context = {
        workspace: workspaceContext,
        projectId: destination,
        clientId: selectedAssociation(
          clientId,
          clientList.results.map((row) => ({ id: row._id }))
        ),
        meetingId: selectedAssociation(
          meetingId,
          meetingList.results.map((row) => ({ id: row._id }))
        ),
        documentIds: pageIds.map((id) => {
          const document = documentList.results.find((row) => row.document._id === id);
          if (!document) throw new Error("A selected document is no longer accessible.");
          return document.document._id;
        }),
      };
      const args = {
        templateId: selectedTemplate._id,
        expectedTemplateRevision: selectedTemplate.revision,
        projectId: destination,
        title,
        input,
        context,
        preferences,
      };
      const signature = JSON.stringify(args);
      if (request.current?.signature !== signature) request.current = { signature, requestId: crypto.randomUUID() };
      const jobId = await generate({ ...args, requestId: request.current.requestId });
      router.push(automationJobPath(workspaceSlug, jobId));
    } catch (requestError) {
      setFormError(summonLLMErrorMessage(requestError));
    } finally {
      setGenerating(false);
    }
  };

  return (
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
            <Select
              required
              value={template}
              onValueChange={(value) => selectTemplate(value)}
              options={[
                { value: "", label: "Select template" },
                ...templates.map((item) => ({ value: item._id, label: item.name })),
              ]}
            />
          </SummonField>
        </div>
        <div className="relative pl-7">
          <span className="absolute top-0 left-0 grid size-5 place-items-center rounded-full bg-accent-primary text-[10px] font-semibold text-white">
            2
          </span>
          <SummonField label="Select Project Context">
            <Select
              required
              value={outputProject}
              onValueChange={(value) => selectProject(value)}
              options={[
                { value: "", label: "Select Plane Project" },
                ...projects
                  .filter((row) => row.membershipRole !== "guest" && row.workspaceRole !== "guest")
                  .map((row) => ({ value: row._id, label: row.name })),
              ]}
            />
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
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Name this document"
            />
          </SummonField>
          <SummonField label="Additional Context (Optional)">
            <TextArea
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              placeholder="Add project, scope, or client-specific requirements..."
              className="min-h-20"
            />
          </SummonField>
          <SummonField label="Upload context document (Optional)">
            <input
              type="file"
              accept=".pdf,.docx,.xlsx,.pptx,.txt,.md,.csv"
              disabled={extractingDocument}
              onChange={(event) => void extractDocument(event)}
              className="text-xs block w-full rounded-lg border border-subtle bg-surface-1 p-2 text-secondary file:mr-2 file:rounded-md file:border-0 file:bg-layer-2 file:px-2 file:py-1 file:text-primary"
            />
            <span className="mt-1 block text-[10px] text-tertiary">
              {extractingDocument
                ? "Reading document..."
                : documentName || "PDF, DOCX, XLSX, PPTX, TXT, MD, CSV · max 10 MB"}
            </span>
          </SummonField>
          <SummonField label="Meeting / audio transcript (Optional)">
            <Select
              value={meetingId}
              onValueChange={(value) => setMeetingId(value)}
              options={[
                { value: "", label: "No meeting source" },
                ...meetingList.results.map((meeting) => ({ value: meeting._id, label: meeting.title })),
              ]}
            />
            <input
              type="file"
              accept=".mp3,.m4a,audio/mpeg,audio/mp4,audio/x-m4a"
              disabled={!meetingId || uploadingAudio}
              onChange={(event) => void uploadMeetingAudio(event)}
              className="text-xs mt-2 block w-full rounded-lg border border-subtle bg-surface-1 p-2 text-secondary file:mr-2 file:rounded-md file:border-0 file:bg-layer-2 file:px-2 file:py-1 file:text-primary"
            />
            <TranscriptionProgress uploading={uploadingAudio} transcription={transcription} transcript={transcript} />
          </SummonField>
          {templateVariables.length ? (
            <details className="rounded-xl border border-subtle bg-layer-1/40 p-2.5" open>
              <summary className="cursor-pointer text-[11px] font-semibold text-primary">
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
            <summary className="cursor-pointer text-[11px] font-semibold text-primary">More verified context</summary>
            <div className="mt-3 grid gap-2.5">
              <SummonField label="Client">
                <Select
                  value={clientId}
                  onValueChange={(value) => setClientId(value)}
                  options={[
                    { value: "", label: "No client source" },
                    ...clientList.results.map((client) => ({ value: client._id, label: client.name })),
                  ]}
                />
              </SummonField>
              <SummonField label="Plane Pages / documents">
                <MultiSelect
                  value={pageIds}
                  onValueChange={(values) => setPageIds(values)}
                  options={documentList.results.map(({ document }) => ({
                    value: document._id,
                    label: document.name,
                  }))}
                />
              </SummonField>
              <label className="inline-flex items-center gap-2 text-[11px] font-medium text-secondary">
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
              <Select
                value={preferences.tone}
                disabled={!options}
                onValueChange={(value) => {
                  const selected = options?.tones.find((tone) => tone === value);
                  if (selected) setPreferences({ ...preferences, tone: selected });
                }}
                options={options?.tones.map((tone) => ({ value: tone, label: tone })) ?? []}
              />
            </SummonField>
            <SummonField label="Detail Level">
              <Select
                value={preferences.detailLevel}
                disabled={!options}
                onValueChange={(value) => {
                  const selected = options?.detailLevels.find((level) => level === value);
                  if (selected) setPreferences({ ...preferences, detailLevel: selected });
                }}
                options={options?.detailLevels.map((level) => ({ value: level, label: level })) ?? []}
              />
            </SummonField>
          </div>
        </div>
        <Button size="xl" type="submit" disabled={!canGeneratePreview} loading={generating} className="w-full">
          <Sparkles className="mr-2 size-4" /> Generate Preview
        </Button>
        <p className="text-center text-[10px] text-tertiary">Files and Plane Pages require a second explicit action.</p>
        {formError ? (
          <div className="bg-red-50 text-red-600 grid gap-2 rounded-lg p-2.5 text-[11px]" role="alert">
            <span>{formError}</span>
            <Button type="button" size="lg" variant="secondary" onClick={() => void generatePreview()}>
              Retry preview
            </Button>
          </div>
        ) : null}
      </form>
    </section>
  );
}

function TranscriptionProgress({
  uploading,
  transcription,
  transcript,
}: {
  uploading: boolean;
  transcription: FunctionReturnType<typeof api.meetings.transcription.runs.latest> | undefined;
  transcript: FunctionReturnType<typeof api.meetings.summary.transcripts.get> | undefined;
}) {
  const transcriptionStatus = transcription?.status;
  return (
    <span className="mt-1 block text-[10px] text-tertiary">
      {uploading
        ? "Uploading audio..."
        : transcriptionStatus === "queued" || transcriptionStatus === "running"
          ? "Audio sedang ditranskripsi..."
          : transcriptionStatus === "failed"
            ? "Transkripsi gagal. Upload ulang MP3 atau M4A."
            : transcript?.available && transcript.hasTranscript
              ? "Transcript siap digunakan."
              : "Pilih meeting, lalu upload MP3 atau M4A · max 250 MB"}
    </span>
  );
}
