/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, Check, CircleAlert } from "lucide-react";
import { Button } from "@plane/propel/button";
import type { ISummonGeneratedArtifact } from "@plane/types";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonCard, SummonPanel, SummonScreen, summonLLMErrorMessage } from "@/components/summon/screen";
import { MarkdownRenderer } from "@/components/ui/markdown-to-component";
import { useProject } from "@/hooks/store/use-project";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";
import { automationInputValue } from "../automation-form";

const OUTPUT_FORMAT_LABELS: Record<ISummonGeneratedArtifact["format"], string> = {
  page: "Page",
  pdf: "PDF",
  docx: "DOCX",
  xlsx: "XLSX",
  pptx: "PPTX",
};

const templateLabel = (type: string) =>
  type
    .replace(/^proposal_(client|vendor)$/, "technical proposal")
    .replace(/^mom_(iglo|summon)$/, "minutes of meeting")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function SummonAutomationDetailPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, jobId } = params;
  const { getProjectById } = useProject();
  const [rendering, setRendering] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [actionError, setActionError] = useState("");
  const { data, error, isLoading, mutate } = useSWR(["summon-automation-job", workspaceSlug, jobId], () =>
    summonService.getAutomationJob(workspaceSlug, jobId)
  );

  if (!data) return <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />;

  const title = automationInputValue(data.input, "title") || templateLabel(data.type);
  const projectName = data.project ? getProjectById(data.project)?.name || data.project : "No project";
  const pageArtifact = data.artifacts.find(({ page_detail }) => page_detail);
  const fileArtifacts = data.artifacts.filter(({ file_detail }) => file_detail);
  const hasPreview = data.status === "completed" && Boolean(data.preview_markdown);

  const generateFiles = async () => {
    if (!hasPreview || fileArtifacts.length) return;
    setRendering(true);
    setActionError("");
    try {
      await summonService.renderAutomationJob(workspaceSlug, data.id);
      await mutate();
    } catch (requestError) {
      setActionError(summonLLMErrorMessage(requestError));
    } finally {
      setRendering(false);
    }
  };

  const publishPreview = async () => {
    if (!hasPreview || pageArtifact) return;
    if (!window.confirm(`Publish ${title} from ${projectName} as a page?`)) return;
    setPublishing(true);
    setActionError("");
    try {
      await summonService.publishAutomationJob(workspaceSlug, data.id);
      await mutate();
    } catch (requestError) {
      setActionError(summonLLMErrorMessage(requestError));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <SummonScreen
      title={title}
      description={`${projectName} · ${data.provider || data.error_summary || data.status}${data.model ? ` · ${data.model}` : ""}`}
      actions={
        <Link
          href={`/${workspaceSlug}/summon/automation/`}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-subtle bg-surface-1 px-3 text-xs font-medium text-primary"
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
              <p className="mt-1 text-12 text-secondary">Rendered Markdown · full document</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-success-subtle px-2.5 py-1 text-12 font-medium text-success-primary">
              {data.status === "completed" ? <Check className="size-3" /> : <CircleAlert className="size-3" />}
              {data.status}
            </span>
          </div>
          {data.context_truncated ? (
            <p className="bg-amber-50 text-amber-700 mt-3 rounded-lg px-3 py-2 text-12">
              Selected context was truncated to 30,000 characters.
            </p>
          ) : null}
          {data.preview_markdown ? (
            <article className="prose-sm dark:prose-invert mt-4 max-w-none prose">
              <MarkdownRenderer markdown={data.preview_markdown} />
            </article>
          ) : (
            <p className="mt-4 text-xs text-tertiary">No completed preview is available.</p>
          )}
        </SummonCard>

        <aside className="space-y-4">
          <SummonPanel title="Document actions">
            <div className="grid gap-2">
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
                onClick={() => void publishPreview()}
              >
                Publish as page
              </Button>
            </div>
            {actionError ? (
              <p className="mt-3 text-12 text-danger-primary" role="alert">
                {actionError}
              </p>
            ) : null}
          </SummonPanel>

          <SummonPanel title="Files and links">
            <div className="grid gap-2">
              {fileArtifacts.map((artifact) =>
                artifact.file_detail ? (
                  <a
                    key={artifact.id}
                    href={artifact.file_detail.href}
                    download={artifact.file_detail.name}
                    className="rounded-lg border border-subtle px-3 py-2 text-12 font-medium text-accent-primary"
                  >
                    Download {OUTPUT_FORMAT_LABELS[artifact.format]}
                  </a>
                ) : null
              )}
              {pageArtifact?.page_detail ? (
                <Link href={pageArtifact.page_detail.href} className="text-12 font-semibold text-accent-primary">
                  Open published page →
                </Link>
              ) : null}
              {!fileArtifacts.length && !pageArtifact ? (
                <p className="text-12 text-tertiary">No files or published page yet.</p>
              ) : null}
            </div>
          </SummonPanel>

          <SummonPanel title="Sources">
            <div className="grid gap-2">
              {data.citations.map((citation) => (
                <Link key={citation.id} href={citation.href} className="text-12 font-medium text-accent-primary">
                  {citation.label}
                </Link>
              ))}
              {!data.citations.length ? <p className="text-12 text-tertiary">No linked sources.</p> : null}
            </div>
          </SummonPanel>
        </aside>
      </div>
    </SummonScreen>
  );
}
