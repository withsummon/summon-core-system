import type { FormEventHandler } from "react";
import { ChevronDown, Send, SlidersHorizontal } from "lucide-react";
import { Button, Input, TextArea } from "@plane/ui";
import type { ISummonClient, ISummonCredential, ISummonMeeting, ISummonPageContext } from "@plane/types";
import { SummonField, SummonSelect } from "@/components/summon/forms";
import { shouldSubmitAssistantComposer } from "./composer-keyboard.js";

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
  onChange: (patch: Partial<AssistantComposerState>) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onRetry: () => void;
}

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
              <SummonSelect
                value={value.toolMode}
                onChange={(event) => props.onChange({ toolMode: event.target.value })}
              >
                <option value="chat">AI chat</option>
                <option value="list_projects">MCP · List projects</option>
                <option value="create_project">MCP · Create project preview</option>
                <option value="list_work_items">MCP · List work items</option>
                <option value="create_work_item">MCP · Create work item preview</option>
                <option value="update_work_item">MCP · Update work item preview</option>
                <option value="add_comment">MCP · Add comment preview</option>
              </SummonSelect>
            </SummonField>
            <SummonField label="Plane MCP credential">
              <SummonSelect
                value={value.mcpCredentialId}
                onChange={(event) => props.onChange({ mcpCredentialId: event.target.value })}
              >
                <option value="">No credential</option>
                {props.credentials?.map((credential) => (
                  <option key={credential.id} value={credential.id}>
                    {credential.name}
                  </option>
                ))}
              </SummonSelect>
            </SummonField>
            <SummonField label="Project context">
              <SummonSelect
                value={value.projectId}
                onChange={(event) => props.onChange({ projectId: event.target.value })}
              >
                <option value="">Automatic</option>
                {props.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </SummonSelect>
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
              <SummonSelect
                value={value.clientId}
                onChange={(event) => props.onChange({ clientId: event.target.value })}
              >
                <option value="">Automatic</option>
                {props.clients?.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </SummonSelect>
            </SummonField>
            <SummonField label="Meeting context">
              <SummonSelect
                value={value.meetingId}
                onChange={(event) => props.onChange({ meetingId: event.target.value })}
              >
                <option value="">Automatic</option>
                {props.meetings?.map((meeting) => (
                  <option key={meeting.id} value={meeting.id}>
                    {meeting.title}
                  </option>
                ))}
              </SummonSelect>
            </SummonField>
            <SummonField label="Plane Pages context">
              <SummonSelect
                multiple
                value={value.pageIds}
                onChange={(event) =>
                  props.onChange({ pageIds: Array.from(event.target.selectedOptions, ({ value: id }) => id) })
                }
                className="h-16 py-1.5"
                aria-describedby="assistant-page-context-help"
              >
                {props.pages?.map((page) => (
                  <option key={page.id} value={page.page}>
                    {page.page_detail.name}
                  </option>
                ))}
              </SummonSelect>
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
              <Button type="button" size="sm" variant="neutral-primary" onClick={props.onRetry}>
                Retry message
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="shadow-sm flex items-end gap-2 rounded-2xl border border-strong bg-surface-1 p-2 focus-within:border-accent-strong">
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
          <Button type="submit" size="sm" loading={props.sending} aria-label="Send message">
            <Send className="size-4" />
          </Button>
        </div>
        <p className="text-center text-[10px] text-tertiary">Enter to send · Shift+Enter for a new line</p>
      </div>
    </form>
  );
}
