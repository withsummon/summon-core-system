/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { useState } from "react";
import type { ComponentProps } from "react";
import { useAction, useConvex, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { FunctionReturnType } from "convex/server";
import type { Doc, Id } from "@summon/convex/data-model";
import { Copy, Check, X } from "lucide-react";
import { Dialog, EDialogWidth } from "@plane/propel/dialog";
import { Button } from "@plane/propel/button";
import { IconButton } from "@plane/propel/icon-button";
import { FileAttachmentDownload } from "@/components/convex-core/tasks/attachments/download";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { usePendingConfirmation, useReloadSubmitting } from "@/hooks/use-reload-confirmation";
import { TypeIcon } from "./type-icon";
export function DocumentPreviewModal({
  jobId,
  address,
  preferredFormat,
  onClose,
}: {
  jobId: Id<"automationJobs">;
  address: FunctionReturnType<typeof api.navigation.address.resolveProjectId>;
  preferredFormat?: NonNullable<Doc<"automationJobs">["artifacts"]>[number]["format"];
  onClose: () => void;
}) {
  const job = useQuery(api.automation.jobs.get, { jobId });

  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false);
  const submitting = useReloadSubmitting();
  const beginPending = usePendingConfirmation("Document changes are still saving.");
  const command = async (operation: () => Promise<unknown>) => {
    if (pending || submitting) return;
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
  const busy = pending || submitting;
  const canWrite = address.projectRole !== "guest" && address.workspaceRole !== "guest";
  if (!job) return <p role="status">Loading preview…</p>;
  if (job.workspaceId !== address.workspace._id || job.projectId !== address.project._id)
    throw new Error("Preview belongs to another project.");
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <Dialog.Panel width={EDialogWidth.XXXXL} className="flex h-[85vh] flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle bg-surface-2/60 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <TypeIcon type={job.template.type} boxed size={20} />
            <div className="min-w-0">
              <Dialog.Title className="text-14 font-semibold break-words text-primary">{job.title}</Dialog.Title>
              <p className="text-xs text-secondary">
                {address.project.name} · {new Date(job._creationTime).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={busy || !job.previewMarkdown}
              onClick={() =>
                command(async () => {
                  await navigator.clipboard.writeText(job.previewMarkdown);
                  setCopied(true);
                })
              }
            >
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
            </Button>
            <IconButton icon={X} variant="ghost" aria-label="Close preview" disabled={busy} onClick={onClose} />
          </div>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto bg-surface-1 p-6 md:p-8">
          {job.status === "running" && (
            <p role="status" className="text-sm text-secondary">
              Generation is running.
            </p>
          )}
          {job.status === "failed" && (
            <p role="alert" className="text-sm text-danger-primary">
              {job.error === "provider_unconfigured"
                ? "An AI provider is not configured. Ask your administrator to configure one before generating a new preview."
                : "Generation failed. Review source access before starting a new request."}
            </p>
          )}
          {job.previewMarkdown && (
            <section>
              <h2 className="text-xs mb-3 font-semibold text-secondary">Markdown source · full document</h2>
              <pre className="text-sm break-words whitespace-pre-wrap text-primary">{job.previewMarkdown}</pre>
            </section>
          )}
          {!!job.citations.length && (
            <details>
              <summary className="text-xs cursor-pointer">Sources ({job.citations.length})</summary>
              <ul className="text-xs mt-2 list-inside list-disc text-secondary">
                {job.citations.map((source) => (
                  <li key={`${source.kind}:${source.id}`}>
                    {source.label} · {source.kind}
                  </li>
                ))}
              </ul>
              {job.contextTruncated && (
                <p className="text-xs mt-2 text-secondary">Source content was shortened to fit the generation limit.</p>
              )}
            </details>
          )}
          {job.status === "completed" && (
            <>
              <ArtifactDownloads
                jobId={jobId}
                preferredFormat={preferredFormat}
                busy={busy}
                canWrite={canWrite}
                pending={pending}
                command={command}
              />
              <PreviewPublication
                job={job}
                address={address}
                busy={busy}
                canWrite={canWrite}
                pending={pending}
                command={command}
              />
            </>
          )}
          {error && (
            <p role="alert" className="text-xs text-danger-primary">
              {error}
            </p>
          )}
        </div>
        <div className="text-xs flex flex-wrap items-center justify-between gap-2 border-t border-subtle bg-surface-2/40 px-6 py-3 text-secondary">
          <span>Your private preview · {job.publishedDocumentId ? "Published" : job.status}</span>
          <span>
            {job.provider}
            {job.model && ` · ${job.model}`}
          </span>
        </div>
      </Dialog.Panel>
    </Dialog>
  );
}

function ArtifactDownloads({
  jobId,
  preferredFormat,
  busy,
  canWrite,
  pending,
  command,
}: Pick<ComponentProps<typeof DocumentPreviewModal>, "jobId" | "preferredFormat"> & {
  busy: boolean;
  canWrite: boolean;
  pending: boolean;
  command: (operation: () => Promise<unknown>) => Promise<void>;
}) {
  const files = useQuery(api.automation.jobs.artifactLinks, { jobId });
  const client = useConvex(),
    render = useAction(api.automation.generate.render);
  return (
    <section className="space-y-3 rounded-lg border border-subtle p-4">
      <h2 className="text-sm font-semibold">Downloads</h2>
      {!files ? (
        <p role="status" className="text-xs">
          Loading rendered files…
        </p>
      ) : files.length === 0 ? (
        <Button disabled={busy || !canWrite} loading={pending} onClick={() => command(() => render({ jobId }))}>
          Prepare files
        </Button>
      ) : (
        <>
          {files.map((file) => (
            <div key={file.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs">
                {file.format.toUpperCase()} · {file.name}
                {preferredFormat === file.format ? " · Selected" : ""}
              </span>
              <FileAttachmentDownload
                name={file.name}
                resolveFile={async () => {
                  const current = await client.query(api.automation.jobs.artifactLinks, { jobId });
                  const found = current.find((row) => row.id === file.id);
                  if (!found) throw new Error("Rendered file is unavailable.");
                  return found;
                }}
              />
            </div>
          ))}
          {preferredFormat && !files.some((file) => file.format === preferredFormat) && (
            <p className="text-xs text-secondary">
              {preferredFormat.toUpperCase()} is not available for this template. Choose one of the rendered files
              above.
            </p>
          )}
        </>
      )}
    </section>
  );
}
function PreviewPublication({
  job,
  address,
  busy,
  canWrite,
  pending,
  command,
}: Pick<ComponentProps<typeof DocumentPreviewModal>, "address"> & {
  job: Doc<"automationJobs">;
  busy: boolean;
  canWrite: boolean;
  pending: boolean;
  command: (operation: () => Promise<unknown>) => Promise<void>;
}) {
  const publish = useAction(api.automation.publish.document);
  const [approval, setApproval] = useState(false);
  if (job.publishedDocumentId)
    return (
      <a
        className="text-sm font-medium text-accent-primary"
        href={`/${address.workspace.slug}/projects/${address.project._id}/pages/${job.publishedDocumentId}`}
      >
        Open published document
      </a>
    );
  return (
    <section className="space-y-3 rounded-lg border border-subtle p-4">
      <h2 className="text-sm font-semibold">Publish to {address.project.name}</h2>
      <p className="text-xs text-secondary">
        Publishing shares this preview, including content from private sources, with project members.
      </p>
      <label className="text-xs flex items-start gap-2">
        <input
          type="checkbox"
          checked={approval}
          disabled={busy || !canWrite}
          onChange={(event) => setApproval(event.target.checked)}
        />
        I approve sharing this preview with {address.project.name} members.
      </label>
      <Button
        disabled={busy || !approval || !canWrite}
        loading={pending}
        onClick={() => command(() => publish({ jobId: job._id }))}
      >
        Publish document
      </Button>
    </section>
  );
}
