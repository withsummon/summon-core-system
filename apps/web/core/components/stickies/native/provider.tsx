import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useBlocker } from "react-router";
import { AlertModalCore } from "@plane/ui";
import { useMutation, usePaginatedQuery } from "convex/react";
import type { Doc, Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { isCommentEmpty } from "@plane/utils";
import { STICKY_COLORS_LIST } from "@/components/editor/sticky-editor/color-palette";
import { StickyDrafts } from "./drafts";

function useController(workspaceId: Id<"workspaces">, workspaceSlug: string) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [allOpen, setAllOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const page = usePaginatedQuery(
    api.stickies.index.list,
    { workspaceId, query, deleted: false },
    { initialNumItems: 20 }
  );
  const createNote = useMutation(api.stickies.index.create);
  const update = useMutation(api.stickies.index.update);
  const removeNote = useMutation(api.stickies.index.remove);
  const moveNote = useMutation(api.stickies.index.move);
  const rows = useRef(new Map<string, Doc<"stickies">>());
  for (const row of page.results) rows.current.set(row._id, row);
  const drafts = useMemo(
    () =>
      new StickyDrafts(async (id, expectedUpdatedAt, changes) => {
        const row = rows.current.get(id);
        if (!row) throw new Error("Sticky is no longer in this view. Your draft has not been saved.");
        return update({ workspaceId, stickyId: row._id, expectedUpdatedAt, ...changes });
      }, redraw),
    [workspaceId, update]
  );
  for (const row of page.results) drafts.observe(row._id, row);
  useEffect(() => {
    drafts.activate();
    return () => drafts.dispose();
  }, [drafts]);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 500);
    return () => clearTimeout(timer);
  }, [search]);
  const busyCreate = useRef(false);
  async function create() {
    if (busyCreate.current) return;
    const latest = page.results[0];
    if (!query && latest && isCommentEmpty(drafts.get(latest._id)?.html ?? latest.html)) return;
    busyCreate.current = true;
    setCreating(true);
    setError(null);
    try {
      await createNote({
        workspaceId,
        backgroundColor: STICKY_COLORS_LIST[Math.floor(Math.random() * STICKY_COLORS_LIST.length)].key,
      });
      setSearch("");
      setQuery("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create sticky.");
    } finally {
      busyCreate.current = false;
      setCreating(false);
    }
  }
  async function remove(id: Id<"stickies">, expectedUpdatedAt: number) {
    const draft = drafts.get(id);
    if (!draft || draft.pending || draft.error) throw new Error("Resolve the unsaved sticky before deleting it.");
    await removeNote({ workspaceId, stickyId: id, expectedUpdatedAt });
  }
  async function move(id: string, targetId: string, placement: "before" | "after") {
    const source = rows.current.get(id);
    const target = rows.current.get(targetId);
    if (!source || !target || source._id === target._id) return;
    await drafts.flush(id);
    await drafts.flush(targetId);
    const sourceDraft = drafts.get(id);
    const targetDraft = drafts.get(targetId);
    if (!sourceDraft || !targetDraft || sourceDraft.pending || targetDraft.pending)
      throw new Error("Wait for both stickies to save before moving them.");
    await drafts.changeRevision(id, (expectedUpdatedAt) =>
      moveNote({
        workspaceId,
        stickyId: source._id,
        targetId: target._id,
        expectedUpdatedAt,
        expectedTargetUpdatedAt: targetDraft.updatedAt,
        placement,
      })
    );
  }
  return {
    workspaceId,
    workspaceSlug,
    ...page,
    drafts,
    search,
    setSearch,
    query,
    creating,
    error,
    setError,
    create,
    remove,
    move,
    allOpen,
    openAll: () => setAllOpen(true),
    closeAll: () => setAllOpen(false),
  };
}
const Context = createContext<ReturnType<typeof useController> | null>(null);
export function NativeStickiesProvider({
  workspaceId,
  workspaceSlug,
  children,
}: {
  workspaceId: Id<"workspaces">;
  workspaceSlug: string;
  children: React.ReactNode;
}) {
  const value = useController(workspaceId, workspaceSlug);
  const blocker = useBlocker(() => value.drafts.hasUnsaved());
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (value.drafts.hasUnsaved()) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [value.drafts]);
  return (
    <Context.Provider value={value}>
      {children}
      <AlertModalCore
        isSubmitting={false}
        isOpen={blocker.state === "blocked"}
        handleClose={() => blocker.state === "blocked" && blocker.reset()}
        handleSubmit={async () => {
          value.drafts.dispose();
          if (blocker.state === "blocked") blocker.proceed();
        }}
        primaryButtonText={{ default: "Leave without saving", loading: "Leaving…" }}
        secondaryButtonText="Stay"
        title="Leave with unsaved stickies?"
        content="Changes that have not saved will be lost. Stay on this page to keep editing or resolve a save error."
      />
    </Context.Provider>
  );
}
export function useNativeStickies() {
  const value = useContext(Context);
  if (!value) throw new Error("NativeStickiesProvider is required.");
  return value;
}
export function useStickiesCommands() {
  const { create, openAll, closeAll, allOpen, drafts } = useNativeStickies();
  return { create, openAll, closeAll, allOpen, flushAll: () => drafts.flushAll() };
}
