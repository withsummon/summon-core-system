import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { FunctionArgs } from "convex/server";
import type { Doc, Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { ClientField } from "../commercial/client-field";
import { mutationMessage, selectClass } from "../commercial/forms";
type Context = FunctionArgs<typeof api.assistant.index.save>["context"];
export function ConversationForm({
  workspaceId,
  conversation,
  onDone,
  onCancel,
  contextLocked = false,
}: {
  workspaceId: Id<"workspaces">;
  conversation: Doc<"assistantConversations"> | null;
  onDone: (id: Id<"assistantConversations">) => void;
  onCancel: () => void;
  contextLocked?: boolean;
}) {
  const save = useMutation(api.assistant.index.save);
  const [title, setTitle] = useState(conversation?.title ?? "");
  const [context, setContext] = useState<Context>(
    conversation?.context ?? { projectId: null, clientId: null, meetingId: null, documentIds: [] }
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-4 rounded-xl border border-subtle-1 p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        try {
          const id = await save({ workspaceId, conversationId: conversation?._id, title, context });
          onDone(id);
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <fieldset className="space-y-4" disabled={pending}>
        <SummonField label="Conversation title">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={255}
            placeholder="What are you working on?"
          />
        </SummonField>
        <details open={!conversation}>
          <summary className="text-sm cursor-pointer font-medium">Context sources</summary>
          <p className="text-xs my-3 text-secondary">Only the selected sources you can access are included.</p>
          {contextLocked && (
            <p className="text-xs mb-3 text-secondary">
              Start a new conversation to change sources after sending a message.
            </p>
          )}
          <fieldset disabled={contextLocked}>
            <ContextFields workspaceId={workspaceId} value={context} onChange={setContext} />
          </fieldset>
        </details>
        <div className="flex gap-2">
          <Button type="submit" loading={pending}>
            {conversation ? "Save conversation" : "Create conversation"}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-danger-primary">
          {error}
        </p>
      )}
    </form>
  );
}
export function ContextFields({
  workspaceId,
  value,
  onChange,
  showProject = true,
}: {
  workspaceId: Id<"workspaces">;
  value: Context;
  onChange: (value: Context) => void;
  showProject?: boolean;
}) {
  const projects = useQuery(api.projects.index.list, { workspaceId });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {showProject && (
        <SummonField label="Project" htmlFor="assistant-project">
          <select
            id="assistant-project"
            className={selectClass}
            value={value.projectId ?? ""}
            onChange={(event) => {
              const project = projects?.find((item) => item._id === event.target.value);
              onChange({ ...value, projectId: project?._id ?? null });
            }}
          >
            <option value="">No project</option>
            {projects?.map((project) => (
              <option key={project._id} value={project._id}>
                {project.name}
              </option>
            ))}
          </select>
        </SummonField>
      )}
      <ClientField
        workspaceId={workspaceId}
        value={value.clientId}
        onChange={(clientId) => onChange({ ...value, clientId })}
      />
      <MeetingContext workspaceId={workspaceId} value={value} onChange={onChange} />
      <DocumentContext workspaceId={workspaceId} value={value} onChange={onChange} />
    </div>
  );
}
function MeetingContext({
  workspaceId,
  value,
  onChange,
}: {
  workspaceId: Id<"workspaces">;
  value: Context;
  onChange: (value: Context) => void;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.meetings.index.list,
    { workspaceId },
    { initialNumItems: 50 }
  );
  return (
    <div className="space-y-2">
      <SummonField label="Meeting" htmlFor="assistant-meeting">
        <select
          id="assistant-meeting"
          className={selectClass}
          value={value.meetingId ?? ""}
          onChange={(event) => {
            const meeting = results.find((item) => item._id === event.target.value);
            onChange({ ...value, meetingId: meeting?._id ?? null });
          }}
        >
          <option value="">No meeting</option>
          {value.meetingId && !results.some((item) => item._id === value.meetingId) && (
            <option value={value.meetingId}>Current meeting</option>
          )}
          {results.map((meeting) => (
            <option key={meeting._id} value={meeting._id}>
              {meeting.title}
            </option>
          ))}
        </select>
      </SummonField>
      {status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => loadMore(50)}>
          Load more meetings
        </Button>
      )}
    </div>
  );
}
function DocumentContext({
  workspaceId,
  value,
  onChange,
}: {
  workspaceId: Id<"workspaces">;
  value: Context;
  onChange: (value: Context) => void;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.documents.index.list,
    { workspaceId },
    { initialNumItems: 50 }
  );
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm mb-2 font-medium">Documents</legend>
      <div className="max-h-44 space-y-2 overflow-y-auto">
        {results.map((document) => (
          <label key={document._id} className="text-sm flex gap-2">
            <input
              type="checkbox"
              checked={value.documentIds.includes(document._id)}
              onChange={(event) =>
                onChange({
                  ...value,
                  documentIds: event.target.checked
                    ? [...value.documentIds, document._id]
                    : value.documentIds.filter((id) => id !== document._id),
                })
              }
            />
            {document.name}
          </label>
        ))}
        {value.documentIds
          .filter((id) => !results.some((document) => document._id === id))
          .map((id) => (
            <label className="text-sm flex gap-2" key={id}>
              <input
                type="checkbox"
                checked
                onChange={() =>
                  onChange({ ...value, documentIds: value.documentIds.filter((selected) => selected !== id) })
                }
              />
              Selected document not loaded
            </label>
          ))}
      </div>
      {status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => loadMore(50)}>
          Load more documents
        </Button>
      )}
      {status === "Exhausted" && !results.length && <p className="text-sm text-secondary">No visible documents.</p>}
    </fieldset>
  );
}
