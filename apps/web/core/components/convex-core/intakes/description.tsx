import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { TaskDescriptionEditor } from "../tasks/description-editor";
import { mutationMessage } from "../commercial/forms";
type Content = FunctionReturnType<typeof api.intakes.description.get>;
export function IntakeDescription({ taskId }: { taskId: Id<"tasks"> }) {
  const content = useQuery(api.intakes.description.get, { taskId });
  const [editing, setEditing] = useState(false);
  if (!content) return <p role="status">Loading submission description…</p>;
  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-16 font-medium">Description</h3>
        {!editing && content.canEdit && (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit description
          </Button>
        )}
      </header>
      {editing ? (
        <DescriptionForm initial={content} onDone={() => setEditing(false)} />
      ) : (
        <TaskDescriptionEditor
          key={`${content.contentVersion?.versionId}:${content.contentVersion?.revision}`}
          taskId={taskId}
          id={`intake-content-${taskId}`}
          label="Submission description"
          placeholder="No description"
          html={content.html}
          editable={false}
        />
      )}
    </section>
  );
}
function DescriptionForm({ initial, onDone }: { initial: Content; onDone: () => void }) {
  const [snapshot] = useState(initial);
  const [html, setHtml] = useState(snapshot.html),
    [uploading, setUploading] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const save = useMutation(api.intakes.description.save);
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (uploading || pending) return;
        setPending(true);
        setError("");
        try {
          await save({ taskId: snapshot.taskId, expectedContentVersion: snapshot.contentVersion, html });
          onDone();
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <TaskDescriptionEditor
        taskId={snapshot.taskId}
        id={`intake-content-edit-${snapshot.taskId}`}
        label="Edit submission description"
        placeholder="Describe the work…"
        html={html}
        editable={!pending}
        onChange={setHtml}
        onUploadingChange={setUploading}
      />
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending} disabled={uploading}>
          Save description
        </Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
