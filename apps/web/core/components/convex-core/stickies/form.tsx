import { useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { STICKY_COLORS_LIST } from "@/components/editor/sticky-editor/color-palette";
import { TaskRichEditor } from "../tasks/rich-editor";
import { mutationMessage } from "../commercial/forms";
type Sticky = FunctionReturnType<typeof api.stickies.index.get>;
export function StickyForm({
  workspaceId,
  initial,
  onDone,
  onCancel,
}: {
  workspaceId: Id<"workspaces">;
  initial: Sticky | null;
  onDone: (id: Id<"stickies">) => void;
  onCancel: () => void;
}) {
  const [snapshot] = useState(initial);
  const [name, setName] = useState(initial?.name ?? ""),
    [html, setHtml] = useState(initial?.html ?? "<p></p>"),
    [backgroundColor, setBackgroundColor] = useState(initial?.backgroundColor ?? null);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const create = useMutation(api.stickies.index.create),
    update = useMutation(api.stickies.index.update);
  return (
    <form
      className="max-w-4xl space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        try {
          const fields = { name: name || null, html, backgroundColor };
          if (snapshot) {
            await update({ workspaceId, stickyId: snapshot._id, expectedUpdatedAt: snapshot.updatedAt, ...fields });
            onDone(snapshot._id);
          } else onDone(await create({ workspaceId, ...fields }));
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <header>
        <p className="text-12 text-secondary">Private note</p>
        <h2 className="text-24 font-semibold">{snapshot ? "Edit sticky" : "Create sticky"}</h2>
      </header>
      {initial?.deletedAt != null && (
        <p role="status" className="text-14 text-secondary">
          This sticky was moved to Trash. Your draft is preserved. Cancel to open the removed note.
        </p>
      )}
      {snapshot && initial?.deletedAt === null && initial.updatedAt !== snapshot.updatedAt && (
        <p role="status" className="text-14 text-secondary">
          This sticky changed while you were editing. Your draft is preserved; saving will check the original revision.
        </p>
      )}
      <fieldset disabled={pending} className="space-y-4">
        <SummonField label="Note title (optional)">
          <Input value={name} maxLength={10000} onChange={(event) => setName(event.target.value)} />
        </SummonField>
        <TaskRichEditor
          id={`sticky-draft-${snapshot?._id ?? "new"}`}
          label="Sticky content"
          placeholder="Write a private note…"
          html={snapshot?.html ?? "<p></p>"}
          editable={!pending}
          onChange={setHtml}
        />
        <fieldset>
          <legend className="mb-2 text-14 font-medium">Background</legend>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={backgroundColor === null ? "primary" : "secondary"}
              onClick={() => setBackgroundColor(null)}
            >
              Default
            </Button>
            {STICKY_COLORS_LIST.map((color) => (
              <button
                type="button"
                key={color.key}
                aria-pressed={backgroundColor === color.key}
                className="rounded-md border border-subtle-1 px-3 py-2 text-14 aria-pressed:outline-2 aria-pressed:outline-accent-strong"
                style={{ backgroundColor: color.backgroundColor }}
                onClick={() => setBackgroundColor(color.key)}
              >
                {color.label}
              </button>
            ))}
          </div>
          {backgroundColor && !STICKY_COLORS_LIST.some((color) => color.key === backgroundColor) && (
            <p className="mt-2 text-12 text-secondary">
              Current custom background is retained until you choose a palette color.
            </p>
          )}
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={pending}>
            Save sticky
          </Button>
          <Button variant="secondary" onClick={onCancel}>
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
