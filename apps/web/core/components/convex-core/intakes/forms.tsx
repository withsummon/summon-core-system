import { useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { TaskRichEditor } from "../tasks/rich-editor";
import { mutationMessage } from "../commercial/forms";
type Detail = FunctionReturnType<typeof api.intakes.index.get>;
const priorities = ["none", "urgent", "high", "medium", "low"] as const satisfies FunctionArgs<
  typeof api.intakes.index.submit
>["priority"][];
export function SubmissionForm({
  projectId,
  initial,
  onDone,
  onCancel,
}: {
  projectId: Id<"projects">;
  initial: Detail | null;
  onDone: (id: Id<"tasks">) => void;
  onCancel: () => void;
}) {
  const submit = useMutation(api.intakes.index.submit),
    edit = useMutation(api.intakes.index.edit);
  const [snapshot] = useState(initial);
  const [title, setTitle] = useState(initial?.task.title ?? ""),
    [html, setHtml] = useState(initial?.html ?? "");
  const [priority, setPriority] = useState<FunctionArgs<typeof api.intakes.index.submit>["priority"]>(
    initial?.task.priority ?? "none"
  );
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="max-w-3xl space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError("");
        try {
          if (snapshot) {
            await edit({
              taskId: snapshot.task._id,
              expectedUpdatedAt: snapshot.intake.updatedAt,
              expectedTaskUpdatedAt: snapshot.task.updatedAt,
              title,
              html,
              ...(snapshot.canEditPriority ? { priority } : {}),
            });
            onDone(snapshot.task._id);
          } else onDone(await submit({ projectId, title, html, priority }));
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <h2 className="text-20 font-semibold">{snapshot ? "Edit submission" : "Submit work for review"}</h2>
      <SummonField label="Submission title">
        <Input required maxLength={255} value={title} onChange={(e) => setTitle(e.target.value)} />
      </SummonField>
      {(!snapshot || snapshot.canEditPriority) && (
        <SummonField label="Submission priority" htmlFor="intake-priority">
          <select
            id="intake-priority"
            className="rounded-md border border-subtle-1 bg-layer-2 p-2 text-14 capitalize"
            value={priority}
            onChange={(e) => {
              const next = priorities.find((value) => value === e.target.value);
              if (next) setPriority(next);
            }}
          >
            {priorities.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </SummonField>
      )}
      <TaskRichEditor
        id={`intake-form-${snapshot?.task._id ?? "new"}`}
        label="Submission description"
        placeholder="Describe the work and why it matters…"
        html={snapshot?.html ?? ""}
        editable={!pending}
        onChange={setHtml}
      />
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          {snapshot ? "Save submission" : "Submit for review"}
        </Button>
        <Button variant="secondary" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
