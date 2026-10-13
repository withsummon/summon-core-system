/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import { Check, CircleAlert } from "lucide-react";
import { Button } from "@plane/propel/button";
import type { ISummonAutomationJob, ISummonGeneratedArtifact } from "@plane/types";
import { SummonCard, SummonPanel } from "@/components/summon/screen";
import { MarkdownRenderer } from "@/components/ui/markdown-to-component";
import { OUTPUT_FORMAT_LABELS } from "../automation-display";

export function AutomationJobPreviewCard({ data }: { data: ISummonAutomationJob }) {
  return (
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
        <p className="mt-3 rounded-lg bg-warning-subtle px-3 py-2 text-12 text-warning-primary">
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
  );
}

export function AutomationJobActionsPanel(props: {
  canGenerateFiles: boolean;
  canPublish: boolean;
  rendering: boolean;
  publishing: boolean;
  actionError: string;
  onGenerateFiles: () => void;
  onPublish: () => void;
}) {
  return (
    <SummonPanel title="Document actions">
      <div className="grid gap-2">
        <Button
          size="xl"
          variant="secondary"
          disabled={!props.canGenerateFiles}
          loading={props.rendering}
          onClick={props.onGenerateFiles}
        >
          Generate files
        </Button>
        <Button size="xl" disabled={!props.canPublish} loading={props.publishing} onClick={props.onPublish}>
          Publish as page
        </Button>
      </div>
      {props.actionError ? (
        <p className="mt-3 text-12 text-danger-primary" role="alert">
          {props.actionError}
        </p>
      ) : null}
    </SummonPanel>
  );
}

export function AutomationJobFilesPanel(props: {
  fileArtifacts: ISummonGeneratedArtifact[];
  pageArtifact: ISummonGeneratedArtifact | undefined;
}) {
  const { fileArtifacts, pageArtifact } = props;
  return (
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
  );
}

export function AutomationJobSourcesPanel({ citations }: { citations: ISummonAutomationJob["citations"] }) {
  return (
    <SummonPanel title="Sources">
      <div className="grid gap-2">
        {citations.map((citation) => (
          <Link key={citation.id} href={citation.href} className="text-12 font-medium text-accent-primary">
            {citation.label}
          </Link>
        ))}
        {!citations.length ? <p className="text-12 text-tertiary">No linked sources.</p> : null}
      </div>
    </SummonPanel>
  );
}
