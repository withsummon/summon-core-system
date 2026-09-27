import { Component, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useSearchParams } from "react-router";
import { api } from "@summon/convex/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { ContextFields } from "../../assistant/conversation-form";
import { mutationMessage, selectClass } from "../../commercial/forms";
type Source = FunctionReturnType<typeof api.meetings.summary.transcripts.get>;
type Context = FunctionArgs<typeof api.meetings.summary.generate.summarize>["context"];
type Scope = { workspaceId: Id<"workspaces">; meetingId: Id<"meetings">; projectId: Id<"projects"> };
export function MeetingSummary(props: Scope) {
  return (
    <SummaryBoundary key={props.meetingId}>
      <Summary {...props} />
    </SummaryBoundary>
  );
}
function Summary({ workspaceId, meetingId, projectId }: Scope) {
  const source = useQuery(api.meetings.summary.transcripts.get, { workspaceId, meetingId });
  const latest = useQuery(api.meetings.summary.runs.latest, { workspaceId, meetingId });
  const summarize = useAction(api.meetings.summary.generate.summarize);
  const cancel = useMutation(api.meetings.summary.runs.cancel);
  const [, setParams] = useSearchParams();
  const [editing, setEditing] = useState(false);
  const [context, setContext] = useState<Context>({ projectId, clientId: null, meetingId: null, documentIds: [] });
  const [approved, setApproved] = useState<Source | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<{ signature: string; requestId: string } | null>(null);
  if (!source) return <p role="status">Loading transcript…</p>;
  if (editing)
    return (
      <TranscriptForm
        workspaceId={workspaceId}
        meetingId={meetingId}
        initial={source}
        onClose={() => setEditing(false)}
      />
    );
  const documentId = source.documentId;
  const running = latest?.status === "running";
  return (
    <section className="space-y-4 rounded-xl border border-subtle-1 p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-20 font-semibold">Transcript & summary</h2>
        <div className="flex flex-wrap gap-2">
          {documentId && (
            <Button
              variant="secondary"
              onClick={() =>
                setParams((current) => {
                  const next = new URLSearchParams(current);
                  next.set("module", "documents");
                  next.set("document", documentId);
                  return next;
                })
              }
            >
              Open meeting document
            </Button>
          )}
          {source.canReplaceSource && (
            <Button variant="secondary" disabled={pending || running} onClick={() => setEditing(true)}>
              {source.transcript ? "Edit transcript" : "Add transcript"}
            </Button>
          )}
        </div>
      </header>
      {source.transcript ? (
        <details>
          <summary className="cursor-pointer text-14 font-medium">
            Source transcript{source.language ? ` · ${source.language}` : ""}
          </summary>
          <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-layer-1 p-4 text-14 break-words whitespace-pre-wrap">
            {source.transcript}
          </pre>
        </details>
      ) : (
        <p className="text-14 text-secondary">
          Add a text transcript to generate structured minutes. The transcript is stored in a private meeting document.
        </p>
      )}
      {source.transcript && !source.canSummarize && (
        <p className="text-14 text-secondary">
          Editing or generating minutes requires write access to an unlocked, private document you own.
        </p>
      )}
      {latest?.status === "failed" && (
        <p role="alert" className="rounded-lg bg-layer-1 p-3 text-14">
          {latest.error === "provider_unconfigured"
            ? "An AI provider is not configured. Your transcript is saved; ask your administrator to configure a provider before trying again."
            : latest.error === "cancelled"
              ? "Summary cancelled. The transcript and existing document are unchanged."
              : "The summary could not be saved. Check current source access and document changes before trying again."}
        </p>
      )}
      {latest?.status === "completed" && latest.result && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-16 font-medium">Last generated summary</h3>
            <span className="text-12 text-secondary">
              {latest.provider} · {latest.model}
            </span>
          </div>
          {(latest.transcriptRevision !== source.transcriptRevision ||
            latest.documentRevision + 1 !== source.documentRevision) && (
            <p className="text-14 text-secondary">The source or document has changed since this summary.</p>
          )}
          <p className="text-14 whitespace-pre-wrap">{latest.result.summary}</p>
          {latest.result.decisions.length > 0 && (
            <div>
              <h4 className="text-14 font-medium">Decisions</h4>
              <ul className="mt-2 list-inside list-disc space-y-1 text-14">
                {[...new Set(latest.result.decisions)].map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-12 text-secondary">Action suggestions are saved in the document. No tasks were created.</p>
        </div>
      )}
      {source.canSummarize && (
        <div className="space-y-4 border-t border-subtle-1 pt-4">
          <details>
            <summary className="cursor-pointer text-14 font-medium">Additional context</summary>
            <fieldset disabled={pending || running} className="mt-4">
              <ContextFields
                workspaceId={workspaceId}
                value={context}
                onChange={(value) => {
                  setContext(value);
                  setApproved(null);
                }}
                showProject={false}
              />
            </fieldset>
          </details>
          <label className="flex items-start gap-2 text-14">
            <input
              type="checkbox"
              className="mt-1"
              disabled={pending || running}
              checked={approved !== null}
              onChange={(e) => setApproved(e.target.checked ? source : null)}
            />
            Replace the meeting document content with generated minutes. Keep its current sharing and preserve the
            source transcript.
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!approved || running}
              loading={pending}
              onClick={async () => {
                if (
                  !approved ||
                  approved.transcriptRevision === null ||
                  approved.documentRevision === null ||
                  approved.documentUpdatedAt === null
                )
                  return;
                const args = {
                  workspaceId,
                  meetingId,
                  expectedMeetingUpdatedAt: approved.meetingUpdatedAt,
                  expectedTranscriptRevision: approved.transcriptRevision,
                  expectedDocumentRevision: approved.documentRevision,
                  expectedDocumentUpdatedAt: approved.documentUpdatedAt,
                  context: { ...context, projectId },
                };
                const signature = JSON.stringify(args);
                if (request.current?.signature !== signature)
                  request.current = { signature, requestId: crypto.randomUUID() };
                setPending(true);
                setError("");
                try {
                  await summarize({ ...args, requestId: request.current.requestId });
                  setApproved(null);
                  request.current = null;
                } catch (failure) {
                  setError(mutationMessage(failure));
                } finally {
                  setPending(false);
                }
              }}
            >
              Generate minutes
            </Button>
            {running && (
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    await cancel({ runId: latest._id });
                  } catch (failure) {
                    setError(mutationMessage(failure));
                  }
                }}
              >
                Cancel summary
              </Button>
            )}
          </div>
        </div>
      )}
      {running && (
        <p role="status" className="text-14 text-secondary">
          Generating minutes… You can return to this meeting to check the result.
        </p>
      )}
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </section>
  );
}
function TranscriptForm({
  workspaceId,
  meetingId,
  initial,
  onClose,
}: {
  workspaceId: Id<"workspaces">;
  meetingId: Id<"meetings">;
  initial: Source;
  onClose: () => void;
}) {
  const save = useAction(api.meetings.summary.transcriptActions.save);
  const [snapshot] = useState(initial);
  const [transcript, setTranscript] = useState(initial.transcript);
  const [language, setLanguage] = useState(initial.language);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-4 rounded-xl border border-subtle-1 p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        try {
          await save({
            workspaceId,
            meetingId,
            transcript,
            language,
            expectedMeetingUpdatedAt: snapshot.meetingUpdatedAt,
            expectedTranscriptRevision: snapshot.transcriptRevision,
            expectedDocumentRevision: snapshot.documentRevision,
            expectedDocumentUpdatedAt: snapshot.documentUpdatedAt,
          });
          onClose();
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <h2 className="text-20 font-semibold">Meeting transcript</h2>
      <fieldset disabled={pending} className="space-y-4">
        <SummonField label="Transcript">
          <textarea
            required
            rows={12}
            maxLength={120000}
            className={`${selectClass} w-full`}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
          />
        </SummonField>
        <SummonField label="Transcript language">
          <Input
            maxLength={100}
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="e.g. English, Indonesian"
          />
        </SummonField>
        <p className="text-14 text-secondary">
          Saving replaces the canonical meeting document content with this transcript. The generated meeting document
          must be private and owned by you.
        </p>
        <div className="flex gap-2">
          <Button type="submit" loading={pending}>
            Save transcript
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </form>
  );
}
class SummaryBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section className="space-y-2 rounded-xl border border-subtle-1 p-5">
        <h2 className="text-20 font-semibold">Transcript unavailable</h2>
        <p role="alert" className="text-14 text-secondary">
          You may not have access to the private meeting document, or its link has changed.
        </p>
      </section>
    ) : (
      this.props.children
    );
  }
}
