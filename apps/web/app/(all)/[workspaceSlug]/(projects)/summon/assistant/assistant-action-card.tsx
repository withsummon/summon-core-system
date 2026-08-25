import { Button } from "@plane/ui";
import type { ISummonAssistantAction } from "@plane/types";
import { Eye } from "lucide-react";
import Link from "next/link";

export function AssistantActionCard(props: {
  action: ISummonAssistantAction;
  busy: boolean;
  anyBusy: boolean;
  workspaceSlug: string;
  onConfirm: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onSelect: (templateId: string) => void;
}) {
  const { action } = props;
  const documentAction = action.tool === "summon_document";
  const automationJobId = action.result.automation_job_id;
  return (
    <div className="rounded-xl border border-subtle bg-layer-1 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-primary">{action.preview.title ?? "Plane MCP action"}</p>
          <p className="text-xs mt-1 text-secondary">{action.preview.summary ?? action.tool}</p>
        </div>
        <span className="rounded-full bg-surface-1 px-2 py-1 text-[10px] font-medium text-secondary uppercase">
          {action.status}
        </span>
      </div>
      {documentAction && action.status === "pending" && action.preview.state === "choose_template" ? (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Document type">
          {action.preview.template_options?.map((template) => (
            <Button
              key={template.id}
              size="sm"
              variant="neutral-primary"
              disabled={props.anyBusy}
              onClick={() => props.onSelect(template.id)}
            >
              {template.name}
            </Button>
          ))}
        </div>
      ) : null}
      {documentAction && action.preview.state === "confirm" ? (
        <dl className="mt-3 grid gap-2 rounded-lg border border-subtle bg-surface-1 p-3 text-[11px] sm:grid-cols-2">
          <div>
            <dt className="text-tertiary">Document type</dt>
            <dd className="font-medium text-primary">{action.preview.template?.name ?? "Not selected"}</dd>
          </div>
          <div>
            <dt className="text-tertiary">Project</dt>
            <dd className="font-medium text-primary">
              {action.preview.project?.name ?? "Select a project in context"}
            </dd>
          </div>
          <div>
            <dt className="text-tertiary">Source files</dt>
            <dd className="font-medium text-primary">
              {action.preview.sources?.map(({ name }) => name).join(", ") || "Conversation context"}
            </dd>
          </div>
          <div>
            <dt className="text-tertiary">Formats</dt>
            <dd className="font-medium text-primary">
              {action.preview.formats?.map((format) => format.toUpperCase()).join(" + ")}
            </dd>
          </div>
        </dl>
      ) : null}
      {action.status === "pending" ? (
        <div className="mt-3 flex gap-2">
          {action.preview.state !== "choose_template" ? (
            <Button
              size="sm"
              loading={props.busy}
              disabled={documentAction && !action.preview.project}
              onClick={props.onConfirm}
            >
              {documentAction ? "Generate" : "Confirm"}
            </Button>
          ) : null}
          <Button size="sm" variant="neutral-primary" disabled={props.anyBusy} onClick={props.onCancel}>
            Cancel
          </Button>
        </div>
      ) : null}
      {documentAction && action.status === "completed" && typeof automationJobId === "string" ? (
        <Link
          href={`/${props.workspaceSlug}/summon/automation/${automationJobId}/`}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-subtle bg-surface-1 px-3 py-2 text-[11px] font-medium text-accent-primary"
        >
          <Eye className="size-3.5" /> Preview generated document
        </Link>
      ) : null}
      {documentAction && action.status === "failed" ? (
        <Button className="mt-3" size="sm" loading={props.busy} disabled={props.anyBusy} onClick={props.onRetry}>
          Retry generation
        </Button>
      ) : null}
      {action.error ? <p className="text-xs mt-2 text-danger-primary">{action.error}</p> : null}
    </div>
  );
}
