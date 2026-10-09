/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { Doc, Id } from "@summon/convex/data-model";
import { AlertModalCore } from "@plane/ui";
import { Button } from "@plane/propel/button";
import { PageHead } from "@/components/core/page-title";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { JobBoundary } from "@/components/convex-core/automation/job-preview";
import { usePendingConfirmation, useReloadSubmitting } from "@/hooks/use-reload-confirmation";
import { TopTemplatesRow } from "./top-templates-row";
import { AIGeneratorForm } from "./ai-generator-form";
import { GeneratedDocumentsTable } from "./generated-documents-table";
import { TemplateLibraryCard } from "./template-library-card";
import { RecentActivityCard } from "./recent-activity-card";
import { DocumentPreviewModal } from "./document-preview-modal";
export function AutomationRootView({
  address,
}: {
  address: FunctionReturnType<typeof api.navigation.address.resolveProjectId>;
}) {
  const { workspace, project } = address;
  const templates = usePaginatedQuery(
    api.automation.templates.list,
    { workspaceId: workspace._id },
    { initialNumItems: 30 }
  );
  const options = useQuery(api.automation.templates.options, { workspaceId: workspace._id });
  const [criteria, setCriteria] = useState<
    Pick<FunctionArgs<typeof api.automation.jobs.list>, "type" | "status" | "search">
  >({});
  const jobs = usePaginatedQuery(
    api.automation.jobs.list,
    { workspaceId: workspace._id, projectId: project._id, ...criteria },
    { initialNumItems: 8 }
  );
  const install = useMutation(api.automation.templates.installDefaults),
    retire = useMutation(api.automation.jobs.retire);
  const [selected, setSelected] = useState<Doc<"automationTemplates"> | null>(null);
  const [preview, setPreview] = useState<{
    jobId: Id<"automationJobs">;
    format?: NonNullable<Doc<"automationJobs">["artifacts"]>[number]["format"];
  } | null>(null);
  const [deleting, setDeleting] = useState<Doc<"automationJobs"> | null>(null);
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [expanded, setExpanded] = useState(false);
  const submitting = useReloadSubmitting(),
    beginPending = usePendingConfirmation("Automation changes are still saving.");
  const busy = pending || submitting;
  const canWrite = address.projectRole !== "guest" && address.workspaceRole !== "guest";
  const template = selected ?? templates.results[0];
  const command = async (operation: () => Promise<unknown>) => {
    if (busy) return;
    const finish = beginPending();
    setPending(true);
    setError("");
    try {
      await operation();
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
      finish();
    }
  };
  const viewAllTemplates = () => {
    setExpanded(true);
    document.getElementById("automation-library")?.scrollIntoView({ behavior: "smooth" });
  };
  const selectJob = (job: Doc<"automationJobs">) => {
    if (!busy) setPreview({ jobId: job._id });
  };
  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-canvas">
      <PageHead title={`${project.name} - AI Document Generator`} />
      <div className="mx-auto w-full max-w-[1600px] space-y-5 p-5 md:p-6 lg:p-7">
        <section>
          <TopTemplatesRow
            templates={templates.results}
            disabled={busy || !canWrite}
            onSelectTemplate={setSelected}
            onViewAllTemplates={viewAllTemplates}
          />
        </section>
        {templates.status === "LoadingFirstPage" && <p role="status">Loading templates…</p>}
        {templates.status === "Exhausted" && !templates.results.length && (
          <div className="rounded-xl border border-subtle bg-surface-1 p-5">
            <p className="text-sm mb-3 text-secondary">No templates are available in this workspace.</p>
            {address.workspaceRole !== "guest" && (
              <Button
                loading={pending}
                disabled={busy}
                onClick={() => command(() => install({ workspaceId: workspace._id }))}
              >
                Install default templates
              </Button>
            )}
          </div>
        )}
        <section className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
          <div className="lg:col-span-4">
            {template && options && (
              <AIGeneratorForm
                template={template}
                templates={templates.results}
                options={options}
                address={address}
                onTemplateChange={setSelected}
                onDone={(jobId, format) => setPreview({ jobId, format })}
              />
            )}
          </div>
          <div className="lg:col-span-8">
            {options && (
              <GeneratedDocumentsTable
                documents={jobs.results}
                templates={templates.results}
                options={options}
                projectName={project.name}
                criteria={criteria}
                onCriteriaChange={(next) => {
                  if (!busy) setCriteria(next);
                }}
                onPreviewDocument={selectJob}
                onDeleteDocument={(job) => {
                  if (!busy) setDeleting(job);
                }}
                busy={busy}
                canDelete={canWrite}
                loading={jobs.status === "LoadingFirstPage" || jobs.status === "LoadingMore"}
                exhausted={jobs.status === "Exhausted"}
                onLoadMore={jobs.status === "CanLoadMore" ? () => jobs.loadMore(8) : undefined}
              />
            )}
          </div>
        </section>
        <section className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
          <div id="automation-library" className="lg:col-span-7 xl:col-span-8">
            <TemplateLibraryCard
              templates={templates.results}
              expanded={expanded}
              disabled={busy || !canWrite}
              onSelectTemplate={setSelected}
              onViewAllTemplates={viewAllTemplates}
            />
            {templates.status === "CanLoadMore" && (
              <Button variant="secondary" className="mt-3" disabled={busy} onClick={() => templates.loadMore(30)}>
                Load more templates
              </Button>
            )}
          </div>
          <div className="lg:col-span-5 xl:col-span-4">
            <RecentActivityCard
              jobs={jobs.results}
              onPreview={selectJob}
              onViewAllActivity={() => {
                if (!busy) {
                  setCriteria({});
                  document.getElementById("automation-documents")?.scrollIntoView({ behavior: "smooth" });
                }
              }}
            />
          </div>
        </section>
        {error && (
          <p role="alert" className="text-sm text-danger-primary">
            {error}
          </p>
        )}
      </div>
      {preview && (
        <JobBoundary key={preview.jobId} onBack={() => setPreview(null)}>
          <DocumentPreviewModal
            jobId={preview.jobId}
            preferredFormat={preview.format}
            address={address}
            onClose={() => {
              if (!busy) setPreview(null);
            }}
          />
        </JobBoundary>
      )}
      <AlertModalCore
        isOpen={deleting !== null}
        isSubmitting={pending}
        handleClose={() => {
          if (!busy) setDeleting(null);
        }}
        handleSubmit={() => {
          if (deleting && !busy)
            void command(async () => {
              await retire({
                jobId: deleting._id,
                expectedCompletedAt: deleting.completedAt,
                expectedPublishedAt: deleting.publishedAt,
                expectedArtifactIds: (deleting.artifacts ?? []).map((artifact) => artifact.assetId),
              });
              setDeleting(null);
            });
        }}
        title="Delete private preview?"
        content="This removes the preview and its file downloads. Published project documents have their own lifecycle."
        primaryButtonText={{ default: "Delete", loading: "Deleting…" }}
        secondaryButtonText="Cancel"
        variant="danger"
      />
    </div>
  );
}
