import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import type { FunctionReturnType } from "convex/server";
import { TaskRichEditor } from "./rich-editor";
import { Button } from "@plane/propel/button";
import { mutationMessage } from "../commercial/forms";
export function RichDescription({ taskId, canWrite }: { taskId: Id<"tasks">; canWrite: boolean }) {
  const description = useQuery(api.tasks.description.get, { taskId });
  const [editing, setEditing] = useState(false);
  if (!description) return <p role="status">Loading description…</p>;
  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-16 font-medium">Description</h3>
        {canWrite && !editing && (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit description
          </Button>
        )}
      </header>
      {editing && canWrite ? (
        <DescriptionForm key={taskId} description={description} onDone={() => setEditing(false)} />
      ) : (
        <TaskRichEditor
          key={description.updatedAt}
          id={`task-description-${taskId}`}
          label="Task description"
          placeholder="Describe the work…"
          html={description.html}
          editable={false}
        />
      )}
    </section>
  );
}
function DescriptionForm({
  description,
  onDone,
}: {
  description: FunctionReturnType<typeof api.tasks.description.get>;
  onDone: () => void;
}) {
  const save = useMutation(api.tasks.description.save);
  const [draft, setDraft] = useState({ html: description.html, expectedUpdatedAt: description.updatedAt });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        try {
          await save({ taskId: description.taskId, ...draft });
          onDone();
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <TaskRichEditor
        id={`task-description-${description.taskId}`}
        label="Task description"
        placeholder="Describe the work…"
        html={description.html}
        editable={!pending}
        onChange={(html) => setDraft((current) => ({ ...current, html }))}
      />
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          Save description
        </Button>
        <Button variant="secondary" disabled={pending} onClick={onDone}>
          Cancel
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </form>
  );
}
