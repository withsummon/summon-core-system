import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import type { FunctionReturnType } from "convex/server";
import { RichTextEditorWithRef } from "@plane/editor";
import type { IEditorProps, TFileHandler } from "@plane/editor";
import { Button } from "@plane/propel/button";
import { mutationMessage } from "../commercial/forms";
const disabledExtensions: IEditorProps["disabledExtensions"] = ["ai", "image", "issue-embed"];
const flaggedExtensions: IEditorProps["flaggedExtensions"] = [];
const extendedEditorProps = {};
const mentionHandler = { renderComponent: () => null };
const getEditorMetaData = () => ({ file_assets: [], user_mentions: [] });
const readEditorProps = {
  attributes: { role: "textbox", "aria-label": "Task description", "aria-multiline": "true", "aria-readonly": "true" },
};
const writeEditorProps = { attributes: { ...readEditorProps.attributes, "aria-readonly": "false" } };
async function unavailable(): Promise<never> {
  throw new Error("Task attachments are not available in this editor yet.");
}
const fileHandler: TFileHandler = {
  assetsUploadStatus: {},
  cancel: () => {},
  checkIfAssetExists: unavailable,
  delete: unavailable,
  getAssetDownloadSrc: unavailable,
  getAssetSrc: unavailable,
  restore: unavailable,
  upload: unavailable,
  duplicate: unavailable,
  validation: { maxFileSize: 0 },
};

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
        <DescriptionEditor key={description.updatedAt} taskId={taskId} html={description.html} editable={false} />
      )}
    </section>
  );
}
function DescriptionEditor({
  taskId,
  html,
  editable,
  onChange,
}: {
  taskId: Id<"tasks">;
  html: string;
  editable: boolean;
  onChange?: (html: string) => void;
}) {
  return (
    <div className="min-h-36 rounded-xl border border-subtle-1 p-3">
      <RichTextEditorWithRef
        id={`task-description-${taskId}`}
        initialValue={html}
        editable={editable}
        disabledExtensions={disabledExtensions}
        flaggedExtensions={flaggedExtensions}
        fileHandler={fileHandler}
        mentionHandler={mentionHandler}
        extendedEditorProps={extendedEditorProps}
        getEditorMetaData={getEditorMetaData}
        editorProps={editable ? writeEditorProps : readEditorProps}
        onChange={(_json, nextHtml) => onChange?.(nextHtml)}
        placeholder="Describe the work…"
      />
    </div>
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
      <DescriptionEditor
        taskId={description.taskId}
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
