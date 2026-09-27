import { lazy, Suspense, useCallback, useMemo, useRef, useState } from "react";
import { useAuthToken } from "@convex-dev/auth/react";
import { CollaborativeDocumentEditorWithRef } from "@plane/editor";
import type { CollaborationState, EditorRefApi, EditorTitleRefApi, IEditorProps, TRealtimeConfig } from "@plane/editor";
import type { FunctionReturnType } from "convex/server";
import { Button } from "@plane/propel/button";
import { api } from "@summon/convex/api";

import { useDocumentAssets } from "./use-document-assets";

const DocumentExport = lazy(() => import("./export").then((module) => ({ default: module.DocumentExport })));

const disabledExtensions: IEditorProps["disabledExtensions"] = ["ai", "issue-embed"];
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
  return <AuthenticatedEditor key={context.documentId} context={context} token={token} url={url} />;
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
  const titleRef = useRef<EditorTitleRefApi>(null);
  const [exporting, setExporting] = useState(false);
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const getToken = useCallback(() => tokenRef.current, []);
  const fileHandler = useDocumentAssets(context.documentId, getToken);
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
  if (!import.meta.env.VITE_CONVEX_SITE_URL)
    return <p role="alert">Document file storage is not configured. Contact your workspace administrator.</p>;
  if (!fileHandler) return <p role="status">Preparing document files…</p>;
  return (
    <section className="space-y-3">
      <div className="text-xs flex flex-wrap items-center justify-between gap-2 text-secondary">
        <span role="status">{statusLabels[state.stage.kind]}</span>
        {!context.canWrite && <span>Read only</span>}
        <Button variant="secondary" onClick={() => setExporting((value) => !value)} aria-expanded={exporting}>
          {exporting ? "Close export" : "Export document"}
        </Button>
      </div>
      {exporting && (
        <Suspense fallback={<p role="status">Opening export…</p>}>
          <DocumentExport
            documentId={context.documentId}
            getToken={getToken}
            snapshot={() => {
              const content = editorRef.current?.getDocument();
              const title = titleRef.current?.getDocument();
              if (!content || !title) throw new Error("Wait for the document editor to open before exporting.");
              return {
                html: content.html,
                title: new DOMParser().parseFromString(title.html, "text/html").body.textContent ?? "",
              };
            }}
          />
        </Suspense>
      )}
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
          titleRef={titleRef}
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
