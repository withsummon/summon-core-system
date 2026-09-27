import { useId, useRef, useState } from "react";
import type { EditorRefApi, ILiteTextEditorProps, TFileHandler } from "@plane/editor";
import type { Doc } from "@summon/convex/data-model";
import { cn, isCommentEmpty } from "@plane/utils";
import { StickyEditorView } from "@/components/editor/sticky-editor/view";
import { STICKY_COLORS_LIST } from "@/components/editor/sticky-editor/color-palette";
import { StickyDeleteModal } from "../delete-modal";
import { useNativeStickies } from "./provider";
const disabled: ILiteTextEditorProps["disabledExtensions"] = [
  "ai",
  "collaboration-cursor",
  "enter-key",
  "image",
  "issue-embed",
];
const flagged: ILiteTextEditorProps["flaggedExtensions"] = [];
const extendedEditorProps = {};
const mentionHandler = { renderComponent: () => null };
const getEditorMetaData = () => ({ file_assets: [], user_mentions: [] });
async function unavailable(): Promise<never> {
  throw new Error("Sticky notes do not support file attachments.");
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
export function NativeStickyNote({ row }: { row: Doc<"stickies"> }) {
  const { drafts, remove, setError } = useNativeStickies();
  const draft = drafts.get(row._id) ?? row;
  const [deleting, setDeleting] = useState<number | null>(null);
  const [generation, setGeneration] = useState(0);
  const editorId = useId();
  const editorRef = useRef<EditorRefApi>(null);
  const color = STICKY_COLORS_LIST.find((item) => item.key === draft.backgroundColor) ?? STICKY_COLORS_LIST[0];
  const error = "error" in draft ? draft.error : null;
  async function confirmDelete() {
    try {
      await drafts.flush(row._id);
      const current = drafts.get(row._id);
      if (!current || current.pending || current.error)
        throw new Error("Resolve the unsaved sticky before deleting it.");
      setDeleting(current.updatedAt);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete sticky.");
    }
  }
  return (
    <>
      <StickyDeleteModal
        isOpen={deleting !== null}
        handleClose={() => setDeleting(null)}
        handleSubmit={async () => {
          if (deleting === null) return;
          await remove(row._id, deleting);
          setDeleting(null);
        }}
      />
      <div
        className="group/sticky flex h-fit w-full flex-col overflow-y-scroll rounded-sm"
        style={{ backgroundColor: color.backgroundColor }}
      >
        <div className="-mt-2">
          <div className="flex-1">
            <StickyEditorView
              key={generation}
              ref={editorRef}
              id={`description-${row._id}-${editorId}`}
              initialValue={draft.html}
              value={draft.html}
              editable
              disabledExtensions={disabled}
              flaggedExtensions={flagged}
              fileHandler={fileHandler}
              mentionHandler={mentionHandler}
              getEditorMetaData={getEditorMetaData}
              extendedEditorProps={extendedEditorProps}
              onChange={(_json, html, metadata) => {
                if (!metadata?.isMigrationUpdate) drafts.edit(row._id, { html });
              }}
              placeholder={(_editor, value) => (isCommentEmpty(value) ? "Click to type here" : "")}
              containerClassName={cn(
                "vertical-scrollbar scrollbar-sm max-h-[540px] min-h-[256px] w-full overflow-y-scroll p-4 text-14",
                "max-h-[588px]"
              )}
              parentClassName="border-none p-0"
              handleDelete={() => {
                void confirmDelete();
              }}
              handleColorChange={async ({ background_color }) => {
                if (background_color) drafts.edit(row._id, { backgroundColor: background_color });
              }}
            />
          </div>
        </div>
        {"pending" in draft && draft.pending && !error && (
          <p role="status" className="px-4 pb-2 text-11 text-primary/60">
            Saving…
          </p>
        )}
        {error && (
          <div role="alert" className="px-4 pb-3 text-13 text-primary">
            <p>{error}</p>
            <p>Your unsaved text remains in this note. Copy it before loading the saved version.</p>
            <button
              type="button"
              className="mr-2 underline"
              onClick={() => {
                void drafts.retry(row._id);
              }}
            >
              Retry save
            </button>
            <button
              type="button"
              className="underline"
              onClick={() => {
                drafts.discard(row._id, row);
                setGeneration((value) => value + 1);
              }}
            >
              Discard draft and load saved version
            </button>
          </div>
        )}
      </div>
    </>
  );
}
