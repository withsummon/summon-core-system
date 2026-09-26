import { useCallback, useMemo, useRef, useState } from "react";
import { useAuthToken } from "@convex-dev/auth/react";
import { CollaborativeDocumentEditorWithRef } from "@plane/editor";
import type { CollaborationState, EditorRefApi, IEditorProps, TFileHandler, TRealtimeConfig } from "@plane/editor";
import type { FunctionReturnType } from "convex/server";
import { Button } from "@plane/propel/button";
import { api } from "@summon/convex/api";

async function attachmentsUnavailable(): Promise<never> {
  throw new Error("File attachments are not available in this editor yet.");
}
const fileHandler: TFileHandler = {
  assetsUploadStatus: {},
  cancel: () => {},
  checkIfAssetExists: attachmentsUnavailable,
  delete: attachmentsUnavailable,
  getAssetDownloadSrc: attachmentsUnavailable,
  getAssetSrc: attachmentsUnavailable,
  restore: attachmentsUnavailable,
  upload: attachmentsUnavailable,
  duplicate: attachmentsUnavailable,
  validation: { maxFileSize: 0 },
};
const disabledExtensions: IEditorProps["disabledExtensions"] = ["ai", "image", "issue-embed"];
const flaggedExtensions: IEditorProps["flaggedExtensions"] = [];
const extendedEditorProps = {};
const editorProps = { attributes: { role: "textbox", "aria-label": "Document content", "aria-multiline": "true" } };
const mentionHandler = { renderComponent: () => null };
const statusLabels = {
  initial: "Starting editor…",
  connecting: "Connecting to collaboration…",
  "awaiting-sync": "Synchronizing document…",
  synced: "Live collaboration",
  reconnecting: "Reconnecting…",
  disconnected: "Disconnected",
} satisfies Record<CollaborationState["stage"]["kind"], string>;
const editorMetadata = () => ({ file_assets: [], user_mentions: [] });

export function DocumentEditor({
  context,
}: {
  context: FunctionReturnType<typeof api.documents.index.collaborationContext>;
}) {
  const token = useAuthToken();
  const url = import.meta.env.VITE_CONVEX_LIVE_URL;
  if (!token) return <p role="status">Restoring editor session…</p>;
  if (!url)
    return <p role="alert">Collaborative editing is unavailable. Please contact your workspace administrator.</p>;
  return <AuthenticatedEditor context={context} token={token} url={url} />;
}
function AuthenticatedEditor({
  context,
  token,
  url,
}: {
  context: FunctionReturnType<typeof api.documents.index.collaborationContext>;
  token: string;
  url: string;
}) {
  const editorRef = useRef<EditorRefApi>(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const getToken = useCallback(() => tokenRef.current, []);
  const [state, setState] = useState<CollaborationState>({
    stage: { kind: "initial" },
    isServerSynced: false,
    isServerDisconnected: false,
  });
  const [readOnly, setReadOnly] = useState(false);
  const [saveError, setSaveError] = useState("");
  const realtimeConfig: TRealtimeConfig = useMemo(
    () => ({
      url,
      authToken: getToken,
      roomName: `convex:${context.documentId}`,
      persistOffline: false,
      cacheKey: `convex:${context.userId}:${context.documentId}`,
      onStateless: (payload) => {
        let event: unknown;
        try {
          event = JSON.parse(payload);
        } catch {
          return;
        }
        if (!event || typeof event !== "object" || !("type" in event)) return;
        if (event.type === "permission" && "readOnly" in event && typeof event.readOnly === "boolean")
          setReadOnly(event.readOnly);
        if (event.type === "save-failed") setSaveError("The document could not be saved.");
      },
    }),
    [url, getToken, context.documentId, context.userId]
  );
  const user = useMemo(
    () => ({ id: context.userId, name: context.name ?? "Collaborator", color: "#635bff" }),
    [context.userId, context.name]
  );
  const serverHandler = useMemo(() => ({ onStateChange: setState }), []);
  const connected = state.isServerSynced;
  return (
    <section className="space-y-3">
      <div className="text-xs flex flex-wrap items-center justify-between gap-2 text-secondary">
        <span role="status">{statusLabels[state.stage.kind]}</span>
        {!context.canWrite && <span>Read only</span>}
      </div>
      {saveError && (
        <p role="alert" className="text-sm rounded-md bg-danger-subtle p-3 text-danger-primary">
          {saveError} Download your local copy before leaving this page, then reload after resolving access.
        </p>
      )}
      {state.isServerDisconnected && (
        <p role="alert" className="text-sm text-danger-primary">
          The editor connection closed. Local changes may not be saved. Check access and reconnect before continuing.
        </p>
      )}
      {(saveError || state.isServerDisconnected) && (
        <Button
          variant="secondary"
          onClick={() => {
            const document = editorRef.current?.getDocument();
            if (!document) return;
            const data = {
              documentId: context.documentId,
              html: document.html,
              json: document.json,
              binary: document.binary ? Array.from(document.binary) : null,
            };
            const downloadUrl = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
            const link = window.document.createElement("a");
            link.href = downloadUrl;
            link.download = "document-local-recovery.json";
            link.click();
            URL.revokeObjectURL(downloadUrl);
          }}
        >
          Download local copy
        </Button>
      )}
      <div className="min-h-96 rounded-xl border border-subtle-1 bg-surface-1 p-3 sm:p-6">
        <CollaborativeDocumentEditorWithRef
          ref={editorRef}
          id={context.documentId}
          realtimeConfig={realtimeConfig}
          serverHandler={serverHandler}
          user={user}
          editable={context.canWrite && !readOnly && !saveError && connected}
          disabledExtensions={disabledExtensions}
          flaggedExtensions={flaggedExtensions}
          fileHandler={fileHandler}
          mentionHandler={mentionHandler}
          getEditorMetaData={editorMetadata}
          extendedEditorProps={extendedEditorProps}
          editorProps={editorProps}
          containerClassName="min-h-96"
          placeholder="Start writing…"
        />
      </div>
    </section>
  );
}
