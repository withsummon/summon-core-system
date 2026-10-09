import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import { useStickiesCommands } from "@/components/stickies/native/provider";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import Link from "next/link";
import { useAction, useQuery, useConvex } from "convex/react";
import { useOutletContext } from "react-router";
import { api } from "@summon/convex/api";
import type { Doc } from "@summon/convex/data-model";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { ArrowLeft, Check, CircleAlert } from "lucide-react";
import { Button } from "@plane/propel/button";
import { Badge } from "@plane/propel/badge";
import { Dialog } from "@plane/propel/dialog";

import { SummonRequestState } from "@/components/summon/request-state";
import { SummonCard, SummonScreen, summonLLMErrorMessage } from "@/components/summon/screen";
import { FileAttachmentDownload } from "@/components/convex-core/tasks/attachments/download";
import { MarkdownRenderer } from "@/components/ui/markdown-to-component";

import type { Route } from "./+types/page";

const OUTPUT_FORMAT_LABELS: Record<"page" | NonNullable<Doc<"automationJobs">["artifacts"]>[number]["format"], string> =
  {
    page: "Plane Page",
    pdf: "PDF",
    docx: "DOCX",
    xlsx: "XLSX",
    pptx: "PPTX",
  };

const GENERATION_ERRORS = {
  provider_unconfigured: "An AI provider is not configured. Configure it before generating a new document.",
  generation_failed:
    "Document generation failed. Check the provider and source access before generating a new document.",
} satisfies Record<NonNullable<Doc<"automationJobs">["error"]>, string>;

export default function SummonAutomationDetailPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, jobId } = params;
  const session = useOutletContext<WorkspaceSession>();
  const { workspace } = session;
  const commands = useStickiesCommands();
  const projects = useQuery(api.projects.index.list, { workspaceId: workspace._id });
  const client = useConvex();
  const render = useAction(api.automation.generate.render);
  const publish = useAction(api.automation.publish.document);
  const [rendering, setRendering] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const data = useQuery(api.automation.jobs.resolve, { jobId });
  const fileArtifacts = useQuery(api.automation.jobs.artifactLinks, data ? { jobId: data._id } : "skip") ?? [];
  if (!data)
    return (
      <PreservedWorkspaceShell
        {...session}
        onCreateSticky={commands.create}
        onOpenStickies={commands.openAll}
        beforeLeave={commands.flushAll}
      >
        <SummonRequestState loading />
      </PreservedWorkspaceShell>
    );
  if (data.workspaceId !== workspace._id) throw new Error("Generation job belongs to another workspace.");
  const title = data.title;
  const projectName = projects?.find((row) => row._id === data.projectId)?.name ?? "Loading project…";
  const pageArtifact = data.publishedDocumentId;
  const hasPreview = data.status === "completed";
  const generateFiles = async () => {
    if (!hasPreview || fileArtifacts.length) return;
    setRendering(true);
    setActionError("");
    try {
      await render({ jobId: data._id });
    } catch (requestError) {
      setActionError(summonLLMErrorMessage(requestError));
    } finally {
      setRendering(false);
    }
  };

  const publishPreview = async () => {
    if (!hasPreview || pageArtifact) return;
    setPublishing(true);
    setActionError("");
    try {
      await publish({ jobId: data._id });
      setPublishOpen(false);
    } catch (requestError) {
      setActionError(summonLLMErrorMessage(requestError));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
      <SummonScreen
        title={title}
        description={[projectName, data.provider, data.model, data.status].filter(Boolean).join(" · ")}
        actions={
          <Link
            href={`/${workspaceSlug}/summon/automation/`}
            className="text-xs inline-flex h-9 items-center gap-2 rounded-xl border border-subtle bg-surface-1 px-3 font-medium text-primary"
          >
            <ArrowLeft className="size-3.5" /> Generated documents
          </Link>
        }
      >
        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <SummonCard className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle pb-3">
              <div>
                <p className="text-xs font-semibold text-primary">Document preview</p>
                <p className="mt-1 text-[10px] text-secondary">Markdown source · full document</p>
              </div>
              <Badge
                variant={data.status === "completed" ? "success" : data.status === "failed" ? "danger" : "neutral"}
                prependIcon={
                  data.status === "completed" ? (
                    <Check aria-hidden />
                  ) : data.status === "failed" ? (
                    <CircleAlert aria-hidden />
                  ) : undefined
                }
              >
                {data.status}
              </Badge>
            </div>
            {data.contextTruncated ? (
              <p className="bg-amber-50 text-amber-700 mt-3 rounded-lg px-3 py-2 text-[11px]">
                Selected context was truncated to 30,000 characters.
              </p>
            ) : null}
            {data.error && (
              <div role="alert" className="text-xs mt-3 space-y-2 text-danger-primary">
                <p>{GENERATION_ERRORS[data.error]}</p>
                <Link
                  href={`/${workspaceSlug}/summon/automation/#automation-generator`}
                  className="font-semibold text-accent-primary"
                >
                  Return to Studio →
                </Link>
              </div>
            )}
            {data.previewMarkdown ? (
              <article className="prose-sm dark:prose-invert mt-4 max-w-none prose">
                <MarkdownRenderer markdown={data.previewMarkdown} />
              </article>
            ) : (
              <p className="text-xs mt-4 text-tertiary">No completed preview is available.</p>
            )}
          </SummonCard>

          <aside className="space-y-4">
            <SummonCard>
              <h2 className="text-xs font-semibold text-primary">Document actions</h2>
              <div className="mt-3 grid gap-2">
                <Button
                  size="xl"
                  variant="secondary"
                  disabled={!hasPreview || Boolean(fileArtifacts.length)}
                  loading={rendering}
                  onClick={() => void generateFiles()}
                >
                  Generate files
                </Button>
                <Button
                  size="xl"
                  disabled={!hasPreview || Boolean(pageArtifact)}
                  loading={publishing}
                  onClick={() => {
                    setActionError("");
                    setPublishOpen(true);
                  }}
                >
                  Publish to Plane Page
                </Button>
              </div>
              {actionError ? (
                <p className="mt-3 text-[11px] text-danger-primary" role="alert">
                  {actionError}
                </p>
              ) : null}
            </SummonCard>

            <SummonCard>
              <h2 className="text-xs font-semibold text-primary">Files and links</h2>
              <div className="mt-3 grid gap-2">
                {fileArtifacts.map((artifact) => (
                  <div key={artifact.id}>
                    <p className="text-[11px] text-secondary">{OUTPUT_FORMAT_LABELS[artifact.format]}</p>
                    <FileAttachmentDownload
                      name={artifact.name}
                      resolveFile={() => client.query(api.assets.index.get, { assetId: artifact.id })}
                    />
                  </div>
                ))}
                {pageArtifact ? (
                  <Link
                    href={`/${workspaceSlug}/projects/${data.projectId}/pages/${pageArtifact}/`}
                    className="text-[11px] font-semibold text-accent-primary"
                  >
                    Open published Plane Page →
                  </Link>
                ) : null}
                {!fileArtifacts.length && !pageArtifact ? (
                  <p className="text-[11px] text-tertiary">No files or published page yet.</p>
                ) : null}
              </div>
            </SummonCard>

            <SummonCard>
              <h2 className="text-xs font-semibold text-primary">Sources</h2>
              <div className="mt-3 grid gap-2">
                {data.citations.map((citation) => {
                  const key = `${citation.kind}:${citation.id}`;
                  if (citation.kind === "attachment")
                    return (
                      <FileAttachmentDownload
                        key={key}
                        name={citation.label}
                        resolveFile={() =>
                          client.query(api.automation.jobs.sourceFile, { jobId: data._id, attachmentId: citation.id })
                        }
                      />
                    );
                  const id = encodeURIComponent(citation.id);
                  const paths = {
                    workspace: "summon/",
                    project: `summon/projects/${id}/`,
                    client: `summon/clients/${id}/`,
                    meeting: `summon/meetings/${id}/`,
                    document: `summon/documents/?document=${id}`,
                  };
                  return (
                    <Link
                      key={key}
                      href={`/${workspaceSlug}/${paths[citation.kind]}`}
                      className="text-[11px] font-medium text-accent-primary"
                    >
                      {citation.label}
                    </Link>
                  );
                })}
                {!data.citations.length ? <p className="text-[11px] text-tertiary">No linked sources.</p> : null}
              </div>
            </SummonCard>
          </aside>
        </div>
        <Dialog
          open={publishOpen}
          onOpenChange={(open) => {
            if (!publishing) setPublishOpen(open);
          }}
        >
          <Dialog.Panel className="space-y-4 p-6">
            <Dialog.Title className="text-18 font-semibold">Publish to Plane Page?</Dialog.Title>
            <Dialog.Description>
              Publish {title} from {projectName} to one canonical Plane Page.
            </Dialog.Description>
            {actionError && (
              <p role="alert" className="text-xs text-danger-primary">
                {actionError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" disabled={publishing} onClick={() => setPublishOpen(false)}>
                Cancel
              </Button>
              <Button loading={publishing} onClick={() => void publishPreview()}>
                Publish page
              </Button>
            </div>
          </Dialog.Panel>
        </Dialog>
      </SummonScreen>
    </PreservedWorkspaceShell>
  );
}
