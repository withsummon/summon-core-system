import { LayoutErrorBoundary } from "@/components/common/layout-error-boundary";
import { DraftEstimate } from "../../estimates/selection";
import { isEqual } from "lodash-es";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage, selectClass } from "../../commercial/forms";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { TaskProperties } from "../task-properties";
import { TaskDescriptionEditor } from "../description-editor";
import { DraftRelationships } from "./relationships";
import { changeDraftProject, hasScopedDraftSelections } from "./project-change";
type Detail = FunctionReturnType<typeof api.tasks.drafts.index.resolve>;
type Save = FunctionArgs<typeof api.tasks.drafts.index.save>;
export function DraftForm({
  initial,
  onDone,
  onStateChange,
  onSaved,
  onCancel,
  submitLabel,
  attachmentsPending = false,
  children,
}: {
  initial: Detail;
  onDone: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  attachmentsPending?: boolean;
  onStateChange?: (state: { dirty: boolean; busy: boolean }) => void;
  children?: ReactNode;
  onSaved?: (receipt: FunctionReturnType<typeof api.tasks.drafts.index.save>) => Promise<void> | void;
}) {
  const [snapshot] = useState(initial);
  const [draft, setDraft] = useState<Save>(() => ({
    draftId: initial._id,
    expectedContentRevision: initial.contentRevision,
    projectId: initial.projectId,
    title: initial.title,
    html: initial.html,
    status: initial.status,
    properties: initial.properties,
    parent: initial.parent,
    cycle: initial.cycle,
    modules: initial.modules,
  }));
  const [saved, setSaved] = useState(draft);
  const dirty = !isEqual(draft, saved);
  const projects = useQuery(api.projects.index.list, { workspaceId: initial.workspaceId });
  const [nextProject, setNextProject] = useState<{ id: Save["projectId"]; name: string } | null>(null);
  const save = useMutation(api.tasks.drafts.index.save);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const busy = pending || uploading || attachmentsPending;
  const completion = useRef<(() => void) | null>(null);
  const leave = useCallback(() => {
    completion.current = null;
    onDone();
  }, [onDone]);
  const release = useReloadConfirmations(
    dirty || busy,
    "Your draft has unsaved changes or an upload is still in progress.",
    leave,
    busy
  );
  useLayoutEffect(() => {
    onStateChange?.({ dirty, busy });
  }, [dirty, busy, onStateChange]);
  useEffect(
    () => () => {
      completion.current = null;
    },
    []
  );
  return (
    <form
      className="max-w-4xl space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        completion.current = onDone;
        setPending(true);
        setError("");
        try {
          const receipt = await save(draft);
          const acknowledged = { ...draft, expectedContentRevision: receipt.contentRevision };
          setDraft(acknowledged);
          setSaved(acknowledged);
          await onSaved?.(receipt);
          release((allow) => {
            const done = completion.current;
            completion.current = null;
            if (allow) done?.();
          });
        } catch (failure) {
          if (completion.current !== null) setError(mutationMessage(failure));
          completion.current = null;
        } finally {
          setPending(false);
        }
      }}
    >
      <header>
        <p className="text-12 text-secondary">Only you · Unpublished</p>
        <h2 className="text-24 font-semibold">Edit task draft</h2>
      </header>
      {initial.contentRevision !== draft.expectedContentRevision && (
        <p role="status" className="text-14 text-secondary">
          This draft changed elsewhere. Your edits are preserved; saving checks the revision you opened.
        </p>
      )}
      {initial.deletedAt !== null && <p role="status">This draft is in Trash. Cancel to open its recovery controls.</p>}
      {initial.publishedTaskId && (
        <p role="status">This draft was published elsewhere. Your unsaved edits are preserved.</p>
      )}
      <LayoutErrorBoundary>
        <DraftEstimate draftId={initial._id} />
      </LayoutErrorBoundary>
      <fieldset disabled={pending} className="space-y-5">
        <SummonField label="Project" htmlFor="draft-project">
          <select
            id="draft-project"
            disabled={!!initial.copySource}
            className={selectClass}
            value={draft.projectId ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              const project = projects?.find((item) => item._id === value);
              if (value === "" || project) {
                const selected = { id: project?._id ?? null, name: project?.name ?? "No project" };
                if (hasScopedDraftSelections(draft)) setNextProject(selected);
                else setDraft(changeDraftProject(draft, selected.id));
              }
            }}
          >
            <option value="">No project yet</option>
            {draft.projectId && projects && !projects.some((project) => project._id === draft.projectId) && (
              <option value={draft.projectId} disabled>
                Selected project unavailable
              </option>
            )}
            {projects?.map((project) => (
              <option key={project._id} value={project._id}>
                {project.name}
              </option>
            ))}
          </select>
        </SummonField>
        {nextProject && (
          <section
            className="space-y-3 rounded-lg border border-subtle-1 p-3"
            aria-label="Confirm draft project change"
          >
            <p className="text-14">
              Change to {nextProject.name}? This clears the selected state, estimate, assignees, labels, parent, cycle,
              and modules. Content, status group, priority, and dates stay in the draft.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setDraft(changeDraftProject(draft, nextProject.id));
                  setNextProject(null);
                }}
              >
                Confirm project change
              </Button>
              <Button variant="secondary" onClick={() => setNextProject(null)}>
                Keep project
              </Button>
            </div>
          </section>
        )}
        <SummonField label="Task title">
          <Input
            maxLength={255}
            value={draft.title}
            placeholder="Untitled draft"
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
        </SummonField>
        <TaskDescriptionEditor
          target={{ draftId: snapshot._id }}
          onUploadingChange={setUploading}
          id={`draft-${snapshot._id}`}
          label="Draft description"
          placeholder="Describe the task…"
          html={draft.html}
          editable={!pending}
          onChange={(html) => setDraft((current) => ({ ...current, html }))}
        />
        <LayoutErrorBoundary>
          <TaskProperties
            projectId={draft.projectId}
            allowDefaultState
            draft={{ ...draft.properties, status: draft.status }}
            onChange={({ status, ...properties }) => setDraft({ ...draft, status, properties })}
          />
          {draft.projectId && (
            <DraftRelationships key={draft.projectId} projectId={draft.projectId} draft={draft} onChange={setDraft} />
          )}
        </LayoutErrorBoundary>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={pending} disabled={nextProject !== null || busy}>
            {submitLabel ?? "Save draft"}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={onCancel ?? onDone}>
            Cancel edits
          </Button>
        </div>
        {children}
      </fieldset>
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </form>
  );
}
