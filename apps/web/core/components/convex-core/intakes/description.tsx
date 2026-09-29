import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { TaskDescriptionEditor } from "../tasks/description-editor";
import { mutationMessage } from "../commercial/forms";
type Content = FunctionReturnType<typeof api.intakes.description.get>;
export function IntakeDescription({
  taskId,
  editing,
  onEdit,
  onDone,
  disabled,
}: {
  taskId: Id<"tasks">;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  disabled: boolean;
}) {
  const content = useQuery(api.intakes.description.get, { taskId });
  if (!content) return <p role="status">Loading submission description…</p>;
  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-16 font-medium">Description</h3>
        {!editing && content.canEdit && (
          <Button variant="secondary" disabled={disabled} onClick={onEdit}>
            Edit description
          </Button>
        )}
      </header>
      {editing ? (
        <DescriptionForm initial={content} onDone={onDone} />
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
  const [uploading, setUploading] = useState(false);
  const {
    handleSubmit,
    watch,
    setValue,
    reset,
    setError,
    formState: { isDirty, isSubmitting, errors },
  } = useForm({ defaultValues: { html: snapshot.html } });
  const save = useMutation(api.intakes.description.save);
  const continuation = useRef<typeof onDone | null>(null);
  const leave = useCallback(() => {
    continuation.current = null;
  }, []);
  const release = useReloadConfirmations(
    isDirty || uploading || isSubmitting,
    "The submission description has unsaved changes or is still saving.",
    leave,
    isSubmitting || uploading
  );
  useEffect(() => leave, [leave]);
  return (
    <form
      className="space-y-3"
      onSubmit={handleSubmit(async ({ html }) => {
        if (uploading) return;
        continuation.current = onDone;
        try {
          await save({ taskId: snapshot.taskId, expectedContentVersion: snapshot.contentVersion, html });
          reset();
          release(() => {
            const complete = continuation.current;
            continuation.current = null;
            complete?.();
          });
        } catch (failure) {
          if (continuation.current !== null) setError("root", { type: "server", message: mutationMessage(failure) });
          continuation.current = null;
        }
      })}
    >
      <TaskDescriptionEditor
        taskId={snapshot.taskId}
        id={`intake-content-edit-${snapshot.taskId}`}
        label="Edit submission description"
        placeholder="Describe the work…"
        html={watch("html")}
        editable={!isSubmitting}
        onChange={(html) => setValue("html", html, { shouldDirty: true })}
        onUploadingChange={setUploading}
      />
      {errors.root && (
        <p role="alert" className="text-14 text-danger-primary">
          {errors.root.message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={isSubmitting} disabled={uploading}>
          Save description
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={isSubmitting}
          onClick={() => {
            reset();
            onDone();
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
