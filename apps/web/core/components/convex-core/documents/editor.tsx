import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getAuthToken } from "@/components/convex-core/provider";
import {
  CollaborativeDocumentEditorWithRef,
  createSnapshot,
  decodeStateVector,
  decodeUpdate,
  encodeStateVectorFromUpdate,
  snapshotContainsUpdate,
} from "@plane/editor";
import type { CollaborationState, EditorRefApi, EditorTitleRefApi, IEditorProps, TRealtimeConfig } from "@plane/editor";
import type { FunctionReturnType } from "convex/server";
import type { Doc } from "@summon/convex/data-model";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@plane/propel/button";
import { Dialog, EDialogWidth } from "@plane/propel/dialog";
import { EmojiPicker, Logo } from "@plane/propel/emoji-icon-picker";
import { CustomMenu } from "@plane/ui";
import { PanelRight, ArrowRightCircle, SmilePlus } from "lucide-react";
import { api } from "@summon/convex/api";
import { cn } from "@plane/utils";
import { usePageFilters } from "@/hooks/use-page-filters";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { PageToolbar } from "@/components/pages/editor/toolbar/toolbar";
import { PageContentBrowser } from "@/components/pages/editor/summary/content-browser";
import { PageNavigationPaneOutlineTabEmptyState } from "@/components/pages/navigation-pane/tab-panels/empty-state/outline";
import { DocumentMentionsProvider, useDocumentMentions } from "./mentions";
import { useDocumentAssets } from "./use-document-assets";
import { DocumentHistory } from "./history";
import { mutationMessage } from "../commercial/forms";

const DocumentExport = lazy(() => import("./export").then((module) => ({ default: module.DocumentExport })));
const disabledExtensions: IEditorProps["disabledExtensions"] = ["ai", "issue-embed"];
const flaggedExtensions: IEditorProps["flaggedExtensions"] = [];
const extendedEditorProps = {};
const editorProps = { attributes: { role: "textbox", "aria-label": "Document content", "aria-multiline": "true" } };
const statusLabels = {
  initial: "Starting editor…",
  connecting: "Connecting to collaboration…",
  "awaiting-sync": "Synchronizing document…",
  synced: "Live collaboration",
  reconnecting: "Reconnecting…",
  disconnected: "Disconnected",
} satisfies Record<CollaborationState["stage"]["kind"], string>;
const editorMetadata = () => ({ file_assets: [], user_mentions: [] });

type Props = {
  context: FunctionReturnType<typeof api.documents.index.collaborationContext>;
  document: Doc<"documents">;
  renderHeader?: (state: CollaborationState, actions: ReactNode, isSaving: boolean) => ReactNode;
};

export function DocumentEditor(props: Props) {
  const url = import.meta.env.VITE_CONVEX_LIVE_URL;
  if (!url)
    return (
      <p role="alert" className="p-6">
        Collaborative editing is unavailable. Please contact your workspace administrator.
      </p>
    );
  return (
    <DocumentMentionsProvider key={props.context.documentId} documentId={props.context.documentId}>
      <AuthenticatedEditor {...props} url={url} />
    </DocumentMentionsProvider>
  );
}

function AuthenticatedEditor({ context, document, renderHeader, url }: Props & { url: string }) {
  const mentionHandler = useDocumentMentions(context.documentId);
  const editorRef = useRef<EditorRefApi>(null);
  const titleRef = useRef<EditorTitleRefApi>(null);
  const [exporting, setExporting] = useState(false);
  const [pane, setPane] = useState<"outline" | "info" | null>(null);
  const [ready, setReady] = useState(false);
  const fileHandler = useDocumentAssets(context.documentId);
  const [state, setState] = useState<CollaborationState>({
    stage: { kind: "initial" },
    isServerSynced: false,
    isServerDisconnected: false,
  });
  const snapshot = useQuery(api.documents.index.snapshot, { documentId: context.documentId });
  const [binary, setBinary] = useState<Uint8Array | null>(null);
  const capture = useCallback(() => setBinary(editorRef.current?.getDocument().binary ?? null), []);
  useEffect(() => {
    if (ready) capture();
  }, [ready, capture]);
  const persisted = useMemo(() => {
    if (!snapshot) return null;
    const bytes = new Uint8Array(snapshot.descriptionBinary);
    return createSnapshot(decodeUpdate(bytes).ds, decodeStateVector(encodeStateVectorFromUpdate(bytes)));
  }, [snapshot]);
  const isSaving = binary !== null && (persisted === null || !snapshotContainsUpdate(persisted, binary));
  useReloadConfirmations(isSaving, "The latest document changes have not been saved yet.");
  const { fontSize, fontStyle, isFullWidth, isStickyToolbarEnabled, handleFullWidth, handleStickyToolbar } =
    usePageFilters();
  const realtimeConfig: TRealtimeConfig = useMemo(
    () => ({
      url,
      authToken: getAuthToken,
      roomName: `convex:${context.documentId}`,
      persistOffline: false,
      cacheKey: `convex:${context.userId}:${context.documentId}`,
    }),
    [url, context.documentId, context.userId]
  );
  const user = useMemo(
    () => ({ id: context.userId, name: context.name ?? "Collaborator", color: "#635bff" }),
    [context.userId, context.name]
  );
  const serverHandler = useMemo(() => ({ onStateChange: setState }), []);
  const displayConfig = useMemo(
    () => ({ fontSize, fontStyle, wideLayout: isFullWidth }),
    [fontSize, fontStyle, isFullWidth]
  );
  const editable = context.canWrite && state.isServerSynced;
  if (!import.meta.env.VITE_CONVEX_SITE_URL)
    return (
      <p role="alert" className="p-6">
        Document file storage is not configured. Contact your workspace administrator.
      </p>
    );
  if (!fileHandler)
    return (
      <p role="status" className="p-6">
        Preparing document files…
      </p>
    );
  const actions = (
    <>
      <CustomMenu.MenuItem onClick={() => handleFullWidth(!isFullWidth)}>Full width</CustomMenu.MenuItem>
      <CustomMenu.MenuItem onClick={() => handleStickyToolbar(!isStickyToolbarEnabled)}>
        Sticky toolbar
      </CustomMenu.MenuItem>
      <CustomMenu.MenuItem disabled={!ready} onClick={() => editorRef.current?.copyMarkdownToClipboard()}>
        Copy markdown
      </CustomMenu.MenuItem>
      <CustomMenu.MenuItem onClick={() => setPane("info")}>Version history</CustomMenu.MenuItem>
      <CustomMenu.MenuItem disabled={!ready} onClick={() => setExporting(true)}>
        Export
      </CustomMenu.MenuItem>
    </>
  );
  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden">
      {renderHeader ? (
        renderHeader(state, actions, isSaving)
      ) : (
        <div className="flex shrink-0 items-center justify-between gap-2 py-2 text-12 text-secondary">
          <span role="status">{isSaving ? "Saving…" : statusLabels[state.stage.kind]}</span>
          <CustomMenu ellipsis placement="bottom-end" closeOnSelect ariaLabel="Page actions">
            {actions}
          </CustomMenu>
        </div>
      )}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div className={cn("flex min-w-0 flex-1 flex-col overflow-hidden", pane && "max-md:hidden")}>
          {isStickyToolbarEnabled && editable && (
            <div id="page-toolbar-container" className="hidden min-h-[52px] shrink-0 items-center px-page-x md:flex">
              <div
                className={cn("page-toolbar-content flex w-full items-center justify-between gap-2", {
                  "wide-layout": isFullWidth,
                })}
              >
                <div className="min-w-0 flex-1">
                  {ready && editorRef.current && <PageToolbar editorRef={editorRef.current} />}
                </div>
                <Button variant="ghost" aria-label="Open page navigation pane" onClick={() => setPane("outline")}>
                  <PanelRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
          <div className="vertical-scrollbar relative min-h-0 flex-1 overflow-y-auto">
            <EditorRecovery
              disconnected={state.isServerDisconnected}
              documentId={context.documentId}
              editor={editorRef.current}
            />
            {!pane && (
              <button
                type="button"
                aria-label="Open page navigation pane"
                className="absolute top-4 right-4 z-10 grid size-7 place-items-center rounded-sm text-secondary hover:bg-layer-1"
                onClick={() => setPane("outline")}
              >
                <PanelRight className="size-3.5" />
              </button>
            )}
            <div className="page-header-container group/page-header">
              <div
                className={cn("mx-auto block w-full max-w-[720px] bg-transparent transition-all", {
                  "max-w-[1152px]": isFullWidth,
                })}
              >
                <DocumentIcon document={document} logo={context.logo} disabled={!editable} />
              </div>
            </div>
            <CollaborativeDocumentEditorWithRef
              ref={editorRef}
              titleRef={titleRef}
              id={context.documentId}
              realtimeConfig={realtimeConfig}
              serverHandler={serverHandler}
              user={user}
              editable={editable}
              disabledExtensions={disabledExtensions}
              flaggedExtensions={flaggedExtensions}
              fileHandler={fileHandler}
              mentionHandler={mentionHandler}
              getEditorMetaData={editorMetadata}
              extendedEditorProps={extendedEditorProps}
              editorProps={editorProps}
              displayConfig={displayConfig}
              onTransaction={capture}
              updatePageProperties={capture}
              containerClassName="h-full p-0 pb-64"
              handleEditorReady={setReady}
              placeholder="Start writing…"
            />
          </div>
        </div>
        {pane && (
          <aside className="flex h-full w-full shrink-0 flex-col border-l border-subtle bg-surface-1 pt-3.5 md:w-[294px]">
            <div className="mb-3.5 flex items-center gap-3 px-3.5">
              <button
                type="button"
                aria-label="Close page navigation pane"
                className="grid size-5 place-items-center text-secondary"
                onClick={() => setPane(null)}
              >
                <ArrowRightCircle className="size-3.5" />
              </button>
              <button
                type="button"
                className="text-13"
                aria-pressed={pane === "outline"}
                onClick={() => setPane("outline")}
              >
                Outline
              </button>
              <button type="button" className="text-13" aria-pressed={pane === "info"} onClick={() => setPane("info")}>
                Info
              </button>
            </div>
            <div className="vertical-scrollbar flex-1 overflow-y-auto px-3.5 pb-4">
              {pane === "outline" ? (
                <PageContentBrowser
                  editorRef={editorRef.current}
                  emptyState={<PageNavigationPaneOutlineTabEmptyState />}
                />
              ) : (
                <DocumentHistory document={document} canWrite={editable} />
              )}
            </div>
          </aside>
        )}
      </div>
      {exporting && (
        <Dialog open onOpenChange={setExporting}>
          <Dialog.Panel width={EDialogWidth.XXL} className="p-4 sm:p-6">
            <Dialog.Title>Export page</Dialog.Title>
            <Suspense fallback={<p role="status">Opening export…</p>}>
              <DocumentExport
                documentId={context.documentId}
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
            <Button variant="secondary" onClick={() => setExporting(false)}>
              Close
            </Button>
          </Dialog.Panel>
        </Dialog>
      )}
    </section>
  );
}

function DocumentIcon({
  document,
  logo,
  disabled,
}: {
  document: Doc<"documents">;
  logo: Props["context"]["logo"];
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const update = useMutation(api.documents.index.update);
  return (
    <div className={cn("flex items-end", logo ? "mt-2 h-[104px]" : "h-[48px]")}>
      <EmojiPicker
        isOpen={open}
        handleToggle={setOpen}
        disabled={disabled || pending}
        label={
          <span
            className={cn(
              "flex items-center gap-1 rounded-sm p-1 text-13 text-tertiary hover:bg-layer-1",
              logo && "-ml-2 grid size-[56px] place-items-center"
            )}
          >
            <span className="sr-only">Change page icon</span>
            {logo ? (
              <Logo logo={logo} size={48} type="lucide" />
            ) : (
              <>
                <SmilePlus className="size-4" />
                Icon
              </>
            )}
          </span>
        }
        onChange={async (selection) => {
          setPending(true);
          setError("");
          try {
            await update({
              documentId: document._id,
              expectedUpdatedAt: document.updatedAt,
              logoProps: {
                in_use: selection.type,
                [selection.type]: selection.type === "emoji" ? { value: selection.value } : selection.value,
              },
            });
          } catch (failure) {
            setError(mutationMessage(failure));
          } finally {
            setPending(false);
          }
        }}
      />
      {error && (
        <p role="alert" className="text-12 text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}

function EditorRecovery({
  disconnected,
  documentId,
  editor,
}: {
  disconnected: boolean;
  documentId: Props["context"]["documentId"];
  editor: EditorRefApi | null;
}) {
  if (!disconnected) return null;
  return (
    <div className="space-y-2 px-page-x py-3">
      <p role="alert" className="text-13 text-danger-primary">
        The editor connection closed. Local changes may not be saved. Download your local copy before leaving, then
        reconnect after resolving access.
      </p>
      <Button
        variant="secondary"
        disabled={!editor}
        onClick={() => {
          const content = editor?.getDocument();
          if (!content) return;
          const data = {
            documentId,
            html: content.html,
            json: content.json,
            binary: content.binary ? Array.from(content.binary) : null,
          };
          const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
          const link = window.document.createElement("a");
          link.href = url;
          link.download = "document-local-recovery.json";
          link.click();
          URL.revokeObjectURL(url);
        }}
      >
        Download local copy
      </Button>
    </div>
  );
}
