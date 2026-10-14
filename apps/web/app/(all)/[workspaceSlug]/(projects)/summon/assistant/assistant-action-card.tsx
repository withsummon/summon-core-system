/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import { ArrowUpRight, FileStack, Plug } from "lucide-react";
import { Button } from "@plane/propel/button";
import type { ISummonAssistantAction } from "@plane/types";
import { Tool, ToolContent, ToolFooter, ToolHeader } from "@/components/ai-elements/tool";
import { StatusBadge } from "@/components/summon/status-badge";

const STATUS_LABELS: Record<ISummonAssistantAction["status"], string> = {
  pending: "Needs your OK",
  confirmed: "Running",
  completed: "Done",
  cancelled: "Cancelled",
  failed: "Failed",
};

/** A write the backend proposed: a Plane MCP change or a generated document. Nothing runs until confirmed. */
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
  const choosingTemplate = documentAction && action.status === "pending" && action.preview.state === "choose_template";
  const facts: Array<[string, string]> = documentAction
    ? [
        ["Document type", action.preview.template?.name ?? "Not selected"],
        ["Project", action.preview.project?.name ?? "Scope the chat to a project"],
        ["Sources", action.preview.sources?.map(({ name }) => name).join(", ") || "This conversation"],
        ["Formats", action.preview.formats?.map((format) => format.toUpperCase()).join(" + ") ?? "PDF + DOCX"],
      ]
    : Object.entries(action.preview.changes ?? {}).map(([key, value]) => [
        key.replaceAll("_", " "),
        typeof value === "string" ? value : JSON.stringify(value),
      ]);

  return (
    <Tool aria-label={action.preview.title ?? "Proposed action"}>
      <ToolHeader
        icon={documentAction ? FileStack : Plug}
        title={action.preview.title ?? (documentAction ? "Generate a document" : "Plane MCP action")}
        description={action.preview.summary ?? action.tool}
        status={<StatusBadge status={action.status} label={STATUS_LABELS[action.status]} />}
      />
      {choosingTemplate ? (
        <ToolContent>
          <p className="mb-2 text-12 text-secondary">Which document should Summon generate?</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Document type">
            {action.preview.template_options?.map((template) => (
              <Button
                key={template.id}
                size="sm"
                variant="secondary"
                disabled={props.anyBusy}
                onClick={() => props.onSelect(template.id)}
              >
                {template.name}
              </Button>
            ))}
          </div>
        </ToolContent>
      ) : null}
      {!choosingTemplate && facts.length ? (
        <ToolContent>
          <dl className="grid gap-x-4 gap-y-2 rounded-lg bg-layer-1 p-3 text-12 sm:grid-cols-2">
            {facts.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-tertiary capitalize">{label}</dt>
                <dd className="truncate font-medium text-primary">{value}</dd>
              </div>
            ))}
          </dl>
        </ToolContent>
      ) : null}
      {action.error ? (
        <ToolContent>
          <p className="text-12 text-danger-primary" role="alert">
            {action.error}
          </p>
        </ToolContent>
      ) : null}
      {action.status === "pending" ? (
        <ToolFooter>
          {!choosingTemplate ? (
            <Button
              size="sm"
              loading={props.busy}
              disabled={props.anyBusy || (documentAction && !action.preview.project)}
              onClick={props.onConfirm}
            >
              {documentAction ? "Generate" : "Confirm"}
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" disabled={props.anyBusy} onClick={props.onCancel}>
            Cancel
          </Button>
        </ToolFooter>
      ) : null}
      {documentAction && action.status === "completed" && typeof automationJobId === "string" ? (
        <ToolFooter>
          <Link
            href={`/${props.workspaceSlug}/summon/automation/${automationJobId}/`}
            className="inline-flex items-center gap-1 text-12 font-medium text-accent-primary hover:underline"
          >
            Preview and download <ArrowUpRight aria-hidden className="size-3.5" />
          </Link>
        </ToolFooter>
      ) : null}
      {documentAction && action.status === "failed" ? (
        <ToolFooter>
          <Button size="sm" variant="secondary" loading={props.busy} disabled={props.anyBusy} onClick={props.onRetry}>
            Retry generation
          </Button>
        </ToolFooter>
      ) : null}
    </Tool>
  );
}
