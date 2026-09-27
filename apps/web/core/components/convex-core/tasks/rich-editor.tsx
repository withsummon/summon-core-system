import { RichTextEditorWithRef } from "@plane/editor";
import type { IEditorProps, TFileHandler } from "@plane/editor";
const disabledExtensions: IEditorProps["disabledExtensions"] = ["ai", "image", "issue-embed"];
const imageExtensions: IEditorProps["disabledExtensions"] = ["ai", "issue-embed"];
const flaggedExtensions: IEditorProps["flaggedExtensions"] = [];
const extendedEditorProps = {};
const mentionHandler = { renderComponent: () => null };
const getEditorMetaData = () => ({ file_assets: [], user_mentions: [] });
async function unavailable(): Promise<never> {
  throw new Error("Task attachments are not available in this editor yet.");
}
const unavailableFileHandler: TFileHandler = {
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

export function TaskRichEditor({
  id,
  label,
  placeholder,
  html,
  editable,
  onChange,
  imageFileHandler,
}: {
  id: string;
  label: string;
  placeholder: string;
  html: string;
  editable: boolean;
  onChange?: (html: string) => void;
  imageFileHandler?: TFileHandler;
}) {
  return (
    <div className="min-h-36 rounded-xl border border-subtle-1 p-3">
      <RichTextEditorWithRef
        id={id}
        initialValue={html}
        editable={editable}
        disabledExtensions={imageFileHandler ? imageExtensions : disabledExtensions}
        flaggedExtensions={flaggedExtensions}
        fileHandler={imageFileHandler ?? unavailableFileHandler}
        mentionHandler={mentionHandler}
        extendedEditorProps={extendedEditorProps}
        getEditorMetaData={getEditorMetaData}
        editorProps={{
          attributes: {
            role: "textbox",
            "aria-label": label,
            "aria-multiline": "true",
            "aria-readonly": editable ? "false" : "true",
          },
        }}
        onChange={(_json, nextHtml) => onChange?.(nextHtml)}
        placeholder={placeholder}
      />
    </div>
  );
}
