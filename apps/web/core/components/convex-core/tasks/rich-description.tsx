import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { debounce } from "lodash-es";
import { useMutation, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import type { FunctionReturnType } from "convex/server";
import type { TNameDescriptionLoader } from "@plane/types";
import { Button } from "@plane/propel/button";
import { TextAutosave } from "@/components/editor/rich-text/description-input/autosave";
import { DescriptionHistory } from "./description-history";
import { TaskImageEditor } from "./image-editor";
import { mutationMessage } from "../commercial/forms";

export function RichDescription({
  taskId,
  canWrite,
  setIsSubmitting,
}: {
  taskId: Id<"tasks">;
  canWrite: boolean;
  setIsSubmitting: (status: TNameDescriptionLoader) => void;
}) {
  const description = useQuery(api.tasks.description.get, { taskId });
  if (!description) return <p role="status">Loading description…</p>;
  return (
    <DescriptionContent key={taskId} description={description} canWrite={canWrite} setIsSubmitting={setIsSubmitting} />
  );
}

function DescriptionContent({
  description,
  canWrite,
  setIsSubmitting,
}: {
  description: FunctionReturnType<typeof api.tasks.description.get>;
  canWrite: boolean;
  setIsSubmitting: (status: TNameDescriptionLoader) => void;
}) {
  const mutation = useMutation(api.tasks.description.save);
  const submit = useMemo(() => {
    let expectedContentVersion = description.contentVersion;
    return async (html: string) => {
      const result = await mutation({ taskId: description.taskId, expectedContentVersion, html });
      expectedContentVersion = result.contentVersion;
      return result.html;
    };
  }, [mutation, description.taskId, description.contentVersion]);
  const [autosave] = useState(() => new TextAutosave(description.html, submit));
  const [html, setHtml] = useState(description.html);
  const uploadingRef = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (autosave.receive(description.html)) setHtml(description.html);
  }, [autosave, description.html, html]);

  const save = useCallback(
    async (retry = false) => {
      if (uploadingRef.current || (!autosave.dirty && !autosave.saving && !retry)) return;
      setIsSubmitting("submitting");
      try {
        await autosave.save(retry);
        if (!autosave.dirty) {
          setHtml(autosave.draft);
          setIsSubmitting("submitted");
        }
        setError("");
      } catch (failure) {
        setIsSubmitting("failed");
        setError(mutationMessage(failure));
      }
    },
    [autosave, setIsSubmitting]
  );
  const delayedSave = useMemo(() => debounce(save, 1500), [save]);
  const onUploadingChange = useCallback(
    (next: boolean) => {
      uploadingRef.current = next;
      setUploading(next);
      if (!next && autosave.canFlushOnUnmount) delayedSave();
    },
    [autosave, delayedSave]
  );
  useEffect(
    () => () => {
      delayedSave.cancel();
      if (!uploadingRef.current && autosave.canFlushOnUnmount) void save();
    },
    [autosave, delayedSave, save]
  );

  return (
    <section className="space-y-3">
      <TaskImageEditor
        target={{ taskId: description.taskId }}
        id={`task-description-${description.taskId}`}
        label="Task description"
        placeholder="Describe the work…"
        html={autosave.draft}
        value={autosave.dirty || autosave.saving ? null : html}
        editable={canWrite}
        containerClassName="-ml-6 border-none p-0! pl-6!"
        onUploadingChange={onUploadingChange}
        onChange={(nextHtml) => {
          if (nextHtml === autosave.draft) return;
          autosave.edit(nextHtml, submit);
          setHtml(nextHtml);
          setIsSubmitting(autosave.status);
          delayedSave();
        }}
      />
      <div className="flex justify-end">
        <DescriptionHistory scope={{ kind: "task", taskId: description.taskId }} />
      </div>
      {error && (
        <div className="space-y-1">
          <p role="alert" className="text-13 text-danger-primary">
            {error}
          </p>
          <Button
            variant="secondary"
            disabled={autosave.saving || uploading || !canWrite}
            onClick={() => void save(true)}
          >
            Retry saving description
          </Button>
        </div>
      )}
    </section>
  );
}
