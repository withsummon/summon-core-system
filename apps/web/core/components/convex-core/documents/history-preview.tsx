import { useCallback, useMemo, useRef } from "react";
import { useAuthToken } from "@convex-dev/auth/react";
import { DocumentEditorWithRef } from "@plane/editor";
import type { IEditorProps, TFileHandler } from "@plane/editor";
import type { Id } from "@summon/convex/data-model";
import { useDocumentAssetReader } from "./use-document-asset-reader";

const disabledExtensions: IEditorProps["disabledExtensions"] = ["ai", "issue-embed"];
const flaggedExtensions: IEditorProps["flaggedExtensions"] = [];
const extendedEditorProps = {};
const mentionHandler = { renderComponent: () => null };
const metadata = () => ({ file_assets: [], user_mentions: [] });
const editorProps = {
  attributes: {
    role: "textbox",
    "aria-label": "Historical document content",
    "aria-readonly": "true",
    "aria-multiline": "true",
  },
};
async function readOnly(): Promise<never> {
  throw new Error("Historical preview cannot change document files.");
}
export function DocumentHistoryPreview({
  documentId,
  html,
  versionId,
}: {
  documentId: Id<"documents">;
  html: string;
  versionId: Id<"documentRevisions">;
}) {
  const token = useAuthToken();
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const getToken = useCallback(() => {
    if (!tokenRef.current) throw new Error("Sign in to view document files.");
    return tokenRef.current;
  }, []);
  const { resolve, source, transfers } = useDocumentAssetReader(documentId, getToken);
  const fileHandler = useMemo(
    () =>
      ({
        assetsUploadStatus: {},
        cancel: () => transfers.cancel(),
        checkIfAssetExists: async (assetId) => (await resolve(assetId)) !== null,
        getAssetSrc: (assetId) => source(assetId, false),
        getAssetDownloadSrc: (assetId) => source(assetId, true),
        delete: readOnly,
        restore: readOnly,
        upload: readOnly,
        duplicate: readOnly,
        validation: { maxFileSize: 0 },
      }) satisfies TFileHandler,
    [resolve, source, transfers]
  );
  return (
    <DocumentEditorWithRef
      id={`document-history-${versionId}`}
      value={html}
      editable={false}
      disabledExtensions={disabledExtensions}
      flaggedExtensions={flaggedExtensions}
      fileHandler={fileHandler}
      mentionHandler={mentionHandler}
      getEditorMetaData={metadata}
      extendedEditorProps={extendedEditorProps}
      editorProps={editorProps}
      containerClassName="min-h-36 rounded-md border border-subtle-1 p-3"
    />
  );
}
