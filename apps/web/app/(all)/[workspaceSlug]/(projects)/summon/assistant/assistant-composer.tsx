import type { FormEventHandler } from "react";
import { ChevronDown, FileAudio, FileText, LoaderCircle, Paperclip, Send, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@plane/propel/button";
import { Input, TextArea } from "@plane/ui";
import type {
  ISummonAssistantAttachment,
  ISummonClient,
  ISummonCredential,
  ISummonMeeting,
  ISummonPageContext,
} from "@plane/types";
import { SummonField } from "@/components/summon/forms";
import { shouldSubmitAssistantComposer } from "./composer-keyboard.js";
import { MultiSelect, Select } from "@plane/propel/select";

export interface AssistantComposerState {
  content: string;
  workspaceContext: boolean;
  projectId: string;
  clientId: string;
  meetingId: string;
  pageIds: string[];
  mcpCredentialId: string;
  toolMode: string;
  workItemId: string;
}

interface AssistantComposerProps {
  value: AssistantComposerState;
  projects: Array<{ id: string; name: string }>;
  clients?: ISummonClient[];
  meetings?: ISummonMeeting[];
  pages?: ISummonPageContext[];
  credentials?: ISummonCredential[];
  sending: boolean;
  contextError: boolean;
  contextTruncated: boolean;
  sendError: string;
  canRetry: boolean;
  attachments: ISummonAssistantAttachment[];
  uploadingFiles: File[];
  removingAttachment: string;
  onChange: (patch: Partial<AssistantComposerState>) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onRetry: () => void;
  onFiles: (files: File[]) => void;
  onRemoveAttachment: (attachmentId: string) => void;
}

const MAX_ATTACHMENTS = 5;

export function AssistantComposer(props: AssistantComposerProps) {
  const { value } = props;
  const focusCount =
    Number(value.workspaceContext) +
    Number(Boolean(value.projectId)) +
    Number(Boolean(value.clientId)) +
    Number(Boolean(value.meetingId)) +
    value.pageIds.length +
    Number(value.toolMode !== "chat");

  return (
    <form onSubmit={props.onSubmit} className="border-t border-subtle bg-surface-1 px-3 py-3 sm:px-5">
      <div className="mx-auto max-w-3xl space-y-2.5">
        <details className="group rounded-xl border border-subtle bg-layer-1/50">
          <summary className="text-xs flex cursor-pointer list-none items-center gap-2 px-3 py-2 font-medium text-secondary focus-visible:outline focus-visible:outline-2">
            <SlidersHorizontal className="size-3.5" />
            <span>Context & tools</span>
            {focusCount ? (
              <span className="rounded-full bg-accent-subtle px-1.5 py-0.5 text-[10px] text-accent-primary">
                {focusCount} active
              </span>
            ) : (
              <span className="text-[10px] text-tertiary">Automatic RAG</span>
            )}
            <ChevronDown className="ml-auto size-3.5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="grid gap-3 border-t border-subtle p-3 sm:grid-cols-2 xl:grid-cols-3">
            <SummonField label="Assistant mode">
              <Select
                value={value.toolMode}
                onValueChange={(next) => props.onChange({ toolMode: next })}
                options={[
                  { value: "chat", label: "AI chat" },
                  { value: "list_projects", label: "MCP \u00b7 List projects" },
                  { value: "create_project", label: "MCP \u00b7 Create project preview" },
                  { value: "list_work_items", label: "MCP \u00b7 List work items" },
                  { value: "create_work_item", label: "MCP \u00b7 Create work item preview" },
                  { value: "update_work_item", label: "MCP \u00b7 Update work item preview" },
                  { value: "add_comment", label: "MCP \u00b7 Add comment preview" },
                ]}
              />
            </SummonField>
            <SummonField label="Plane MCP credential">
              <Select
                value={value.mcpCredentialId}
                onValueChange={(next) => props.onChange({ mcpCredentialId: next })}
                options={[
                  { value: "", label: "No credential" },
                  ...(props.credentials ?? []).map((credential) => ({ value: credential.id, label: credential.name })),
                ]}
              />
            </SummonField>
            <SummonField label="Project context">
              <Select
                value={value.projectId}
                onValueChange={(next) => props.onChange({ projectId: next })}
                options={[
                  { value: "", label: "Automatic" },
                  ...props.projects.map((project) => ({ value: project.id, label: project.name })),
                ]}
              />
            </SummonField>
            {["update_work_item", "add_comment"].includes(value.toolMode) ? (
              <SummonField label="Plane work item ID">
                <Input
                  value={value.workItemId}
                  onChange={(event) => props.onChange({ workItemId: event.target.value })}
                  required
                />
              </SummonField>
            ) : null}
            <SummonField label="Client context">
              <Select
                value={value.clientId}
                onValueChange={(next) => props.onChange({ clientId: next })}
                options={[
                  { value: "", label: "Automatic" },
                  ...(props.clients ?? []).map((client) => ({ value: client.id, label: client.name })),
                ]}
              />
            </SummonField>
            <SummonField label="Meeting context">
              <Select
                value={value.meetingId}
                onValueChange={(next) => props.onChange({ meetingId: next })}
                options={[
                  { value: "", label: "Automatic" },
                  ...(props.meetings ?? []).map((meeting) => ({ value: meeting.id, label: meeting.title })),
                ]}
              />
            </SummonField>
            <SummonField label="Plane Pages context">
              <MultiSelect
                value={value.pageIds}
                onValueChange={(values) => props.onChange({ pageIds: values })}
                aria-describedby="assistant-page-context-help"
                options={(props.pages ?? []).map((page) => ({ value: page.page, label: page.page_detail.name }))}
              />
            </SummonField>
            <label className="text-xs inline-flex items-center gap-2 self-end pb-2 font-medium text-secondary">
              <input
                type="checkbox"
                checked={value.workspaceContext}
                onChange={(event) => props.onChange({ workspaceContext: event.target.checked })}
                className="accent-accent-primary size-4"
              />
              Include workspace summary
            </label>
            <p id="assistant-page-context-help" className="self-end pb-2 text-[11px] text-tertiary">
              Authorized project and document context is retrieved automatically. These selections add focus.
            </p>
          </div>
        </details>

        {props.contextError ? (
          <p className="text-xs text-danger-primary">Could not load every context option.</p>
        ) : null}
        {props.contextTruncated ? (
          <p className="text-xs rounded-lg bg-warning-subtle/20 px-3 py-2 text-warning-primary" role="status">
            Selected source context was truncated to the 30,000-character limit.
          </p>
        ) : null}
        {props.sendError ? (
          <div className="flex flex-wrap items-center justify-between gap-2" role="alert">
            <p className="text-xs text-danger-primary">{props.sendError}</p>
            {props.canRetry ? (
              <Button type="button" size="lg" variant="secondary" onClick={props.onRetry}>
                Retry message
              </Button>
            ) : null}
          </div>
        ) : null}

        {props.attachments.length || props.uploadingFiles.length ? (
          <div className="flex flex-wrap gap-2" aria-label="File context">
            {props.attachments.map((attachment) => {
              const AudioIcon = attachment.media_type.startsWith("audio/") ? FileAudio : FileText;
              return (
                <span
                  key={attachment.id}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-subtle bg-layer-1 px-2.5 py-1.5 text-[11px] text-secondary"
                >
                  <AudioIcon className="size-3.5 flex-none" />
                  <span className="max-w-44 truncate">{attachment.original_name}</span>
                  <span className={attachment.status === "failed" ? "text-danger-primary" : "text-tertiary"}>
                    {attachment.status === "processing" ? "transcribing" : attachment.status}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${attachment.original_name}`}
                    disabled={props.removingAttachment === attachment.id}
                    onClick={() => props.onRemoveAttachment(attachment.id)}
                    className="rounded p-0.5 hover:bg-layer-2 disabled:opacity-50"
                  >
                    {props.removingAttachment === attachment.id ? (
                      <LoaderCircle className="size-3 animate-spin" />
                    ) : (
                      <X className="size-3" />
                    )}
                  </button>
                </span>
              );
            })}
            {props.uploadingFiles.map((file) => (
              <span
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-subtle bg-layer-1 px-2.5 py-1.5 text-[11px] text-secondary"
              >
                <LoaderCircle className="size-3.5 animate-spin" /> {file.name} · uploading
              </span>
            ))}
          </div>
        ) : null}

        <div
          className="shadow-sm flex items-end gap-2 rounded-2xl border border-strong bg-surface-1 p-2 focus-within:border-accent-strong"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            props.onFiles(Array.from(event.dataTransfer.files));
          }}
        >
          <label className="grid size-8 flex-none cursor-pointer place-items-center rounded-lg text-secondary hover:bg-layer-1 hover:text-primary">
            <Paperclip className="size-4" />
            <span className="sr-only">Attach files</span>
            <input
              type="file"
              multiple
              accept=".pdf,.docx,.xlsx,.pptx,.txt,.md,.csv,.mp3,.m4a,audio/mpeg,audio/mp3,audio/mp4,audio/m4a,audio/x-m4a"
              disabled={props.attachments.length + props.uploadingFiles.length >= MAX_ATTACHMENTS}
              onChange={(event) => {
                props.onFiles(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
              className="sr-only"
            />
          </label>
          <TextArea
            required
            aria-label="Message Summon Assistant"
            value={value.content}
            onChange={(event) => props.onChange({ content: event.target.value })}
            onKeyDown={(event) => {
              if (
                !shouldSubmitAssistantComposer({
                  key: event.key,
                  shiftKey: event.shiftKey,
                  isComposing: event.nativeEvent.isComposing,
                })
              )
                return;
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }}
            placeholder="Message Summon Assistant…"
            className="max-h-40 min-h-12 flex-1 resize-y border-0 bg-transparent shadow-none"
          />
          <Button type="submit" size="lg" loading={props.sending} aria-label="Send message">
            <Send className="size-4" />
          </Button>
        </div>
        <p className="text-center text-[10px] text-tertiary">
          Attach up to {MAX_ATTACHMENTS} files · documents 10 MB · MP3/M4A 250 MB
        </p>
      </div>
    </form>
  );
}
