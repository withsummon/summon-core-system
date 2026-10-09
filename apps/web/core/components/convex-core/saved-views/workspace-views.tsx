import { observer } from "mobx-react";
import { taskExpression } from "@summon/convex/task-schema";
import { useTaskFilterDraft } from "./filters";
import { useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";
import { useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { FavoriteControl, ViewBoundary, ViewLifecycleCommand, ViewPreviewControls } from "./saved-views";
import { useTranslation } from "@plane/i18n";
import { EditIcon, LinkIcon, NewTabIcon, TrashIcon, ViewsIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Breadcrumbs, CustomMenu, Header, Row } from "@plane/ui";
import { copyUrlToClipboard } from "@plane/utils";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { PageHead } from "@/components/core/page-title";
import { mutationMessage } from "../commercial/forms";
import { SavedViewEditor } from "@/app/(all)/[workspaceSlug]/(projects)/workspace-views/page";
import { TaskPeek } from "../tasks/task-detail";
import { WorkspaceViewLayoutRoot } from "@/components/issues/issue-layouts/roots/project-view-layout-root";
import useReloadConfirmations, { usePendingConfirmation, useReloadSubmitting } from "@/hooks/use-reload-confirmation";
import { WorkspaceReferenceFilters, WorkspaceViewForm } from "./workspace-form";
type Workspace = FunctionReturnType<typeof api.workspaces.index.list>[number];
type Detail = FunctionReturnType<typeof api.savedViews.workspace.get>;
export function WorkspaceViews({ workspace }: { workspace: Workspace }) {
  const [params, setParams] = useSearchParams();
  const selected = params.get("savedView"),
    tab =
      params.get("savedViewTab") === "trash"
        ? "trash"
        : params.get("savedViewTab") === "favorites"
          ? "favorites"
          : "all";
  const [creating, setCreating] = useState(false);
  const all = usePaginatedQuery(
    api.savedViews.workspace.list,
    selected || creating || tab === "favorites" ? "skip" : { workspaceId: workspace._id, deleted: tab === "trash" },
    { initialNumItems: 30 }
  );
  const favorites = usePaginatedQuery(
    api.savedViews.workspace.favorites,
    selected || creating || tab !== "favorites" ? "skip" : { workspaceId: workspace._id },
    { initialNumItems: 30 }
  );
  const rows = tab === "favorites" ? favorites : all;
  const select = (id: Id<"savedViews"> | null) => {
    setCreating(false);
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (id) next.set("savedView", id);
      else next.delete("savedView");
      return next;
    });
  };
  if (creating)
    return (
      <WorkspaceViewForm
        workspaceId={workspace._id}
        initial={null}
        onDone={select}
        onCancel={() => setCreating(false)}
      />
    );
  if (selected)
    return (
      <ViewBoundary key={selected} onBack={() => select(null)}>
        <WorkspaceViewDetail
          workspace={workspace}
          rawId={selected}
          onCreated={select}
          onBack={() => select(null)}
          onLifecycle={(deleted) =>
            setParams((current) => {
              const next = new URLSearchParams(current);
              next.delete("savedView");
              next.set("savedViewTab", deleted ? "trash" : "all");
              return next;
            })
          }
        />
      </ViewBoundary>
    );
  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-12 text-secondary">{workspace.name}</p>
          <h1 className="text-28 font-semibold">Workspace views</h1>
          <p className="mt-1 text-14 text-secondary">Saved task filters across accessible projects.</p>
        </div>
        <Button onClick={() => setCreating(true)}>Create workspace view</Button>
      </header>
      <nav aria-label="Workspace view lists" className="flex flex-wrap gap-2">
        {(
          [
            { value: "all", label: "All views" },
            { value: "favorites", label: "Favorites" },
            { value: "trash", label: "Trash" },
          ] as const
        ).map((item) => (
          <Button
            key={item.value}
            variant={tab === item.value ? "primary" : "secondary"}
            onClick={() =>
              setParams((current) => {
                const next = new URLSearchParams(current);
                next.set("savedViewTab", item.value);
                return next;
              })
            }
          >
            {item.label}
          </Button>
        ))}
      </nav>
      <ul className="divide-y divide-subtle-1">
        {rows.results.map((row) => (
          <li key={row.view._id} className="flex items-center justify-between gap-3 py-4">
            <button className="min-w-0 flex-1 text-left" onClick={() => select(row.view._id)}>
              <span className="block text-16 font-medium break-words">{row.view.name}</span>
              {row.view.description && (
                <span className="mt-1 line-clamp-2 block text-14 break-words text-secondary">
                  {row.view.description}
                </span>
              )}
            </button>
            <WorkspaceFavorite detail={row} />
          </li>
        ))}
      </ul>
      {rows.status === "LoadingFirstPage" && <p role="status">Loading workspace views…</p>}
      {rows.status === "Exhausted" && !rows.results.length && (
        <p className="text-14 text-secondary">No workspace views available in this list.</p>
      )}
      {rows.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => rows.loadMore(30)}>
          Load more views
        </Button>
      )}
    </section>
  );
}
export function WorkspaceViewDetail({
  workspace,
  rawId,
  onBack,
  onLifecycle,
  onCreated,
}: {
  workspace: Pick<Workspace, "_id" | "slug" | "name">;
  rawId: string;
  onBack: () => void;
  onLifecycle: (deleted: boolean) => void;
  onCreated: (id: Id<"savedViews">) => void;
}) {
  const detail = useQuery(api.savedViews.workspace.resolve, { viewId: rawId });
  if (!detail)
    return (
      <p role="status" className="p-5">
        Opening workspace view…
      </p>
    );
  if (detail.view.workspaceId !== workspace._id || detail.view.projectId !== null)
    throw new Error("View belongs to another scope.");
  return (
    <WorkspaceViewContent
      key={detail.view._id}
      workspace={workspace}
      detail={detail}
      onBack={onBack}
      onLifecycle={onLifecycle}
      onCreated={onCreated}
    />
  );
}
const WorkspaceViewContent = observer(function WorkspaceViewContent({
  workspace,
  detail,
  onBack,
  onLifecycle,
  onCreated,
}: {
  workspace: Pick<Workspace, "_id" | "slug" | "name">;
  detail: Detail;
  onBack: () => void;
  onLifecycle: (deleted: boolean) => void;
  onCreated: (id: Id<"savedViews">) => void;
}) {
  const { t } = useTranslation();
  const filter = useTaskFilterDraft(detail.view.filters, detail.view._id);
  const filterSnapshot = useRef(detail);
  const [preview, setPreview] = useState<{
    snapshot: Detail;
    input: FunctionArgs<typeof api.savedViews.workspace.create> &
      Pick<Detail["view"], "displayFilters" | "displayProperties">;
  } | null>(null);
  useEffect(() => {
    if (!filter.hasChanges && !preview) filterSnapshot.current = detail;
  }, [detail, filter, filter.hasChanges, preview]);
  const parsedFilters = taskExpression.safeParse(filter.expression);
  const discardPreview = () => {
    filter.resetExpression(detail.view.filters);
    setPreview(null);
  };
  const [editor, setEditor] = useState<
    { snapshot: Detail } | { seed?: NonNullable<ComponentProps<typeof WorkspaceViewForm>["createSeed"]> } | null
  >(null);
  const [lifecycle, setLifecycle] = useState<Detail | null>(null);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const isSubmitting = useReloadSubmitting();
  const beginPending = usePendingConfirmation("Workspace view changes are still saving.");
  const update = useMutation(api.savedViews.workspace.update);
  const remove = useMutation(api.savedViews.workspace.lifecycle);
  const favorite = useMutation(api.savedViews.workspace.favorite);
  const input = preview
    ? preview.input
    : {
        workspaceId: workspace._id,
        name: detail.view.name,
        description: detail.view.description,
        filters: detail.view.filters,
        displayFilters: detail.view.displayFilters,
        displayProperties: detail.view.displayProperties,
        access: detail.view.access,
        logoProps: detail.view.logoProps,
      };
  const { displayFilters, displayProperties } = input;
  const dirty =
    filter.hasChanges ||
    (preview !== null &&
      JSON.stringify([displayFilters, displayProperties]) !==
        JSON.stringify([preview.snapshot.view.displayFilters, preview.snapshot.view.displayProperties]));
  const release = useReloadConfirmations(dirty, "This view has unsaved changes.", discardPreview, pending);
  const command = async (operation: () => Promise<unknown>) => {
    if (pending || isSubmitting) return;
    const complete = beginPending();
    setPending(true);
    setError("");
    try {
      await operation();
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
      complete();
    }
  };
  const change = (criteria: Pick<NonNullable<typeof preview>["input"], "displayFilters" | "displayProperties">) => {
    if (!pending && !isSubmitting)
      setPreview({ snapshot: preview?.snapshot ?? filterSnapshot.current, input: { ...input, ...criteria } });
  };
  const busy = pending || isSubmitting || editor !== null || lifecycle !== null;
  const path = `/${workspace.slug}/workspace-views/${detail.view._id}/`;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHead title={`${workspace.name} - ${detail.view.name}`} />
      <Row className="z-[18] flex min-h-11 shrink-0 items-center border-b border-subtle bg-surface-1">
        <Header className="min-w-0 flex-wrap py-2 sm:flex-nowrap sm:py-0">
          <Header.LeftItem className="w-full max-w-full min-w-0 sm:w-auto sm:max-w-[80%]">
            <Breadcrumbs>
              <Breadcrumbs.Item
                component={<BreadcrumbLink label={t("views")} icon={<ViewsIcon className="h-4 w-4 text-tertiary" />} />}
              />
              <Breadcrumbs.Item component={<span className="truncate text-13">{detail.view.name}</span>} isLast />
            </Breadcrumbs>
          </Header.LeftItem>
          <Header.RightItem className="w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
            <Button variant="primary" size="lg" disabled={busy} onClick={() => setEditor({})}>
              {t("workspace_views.add_view")}
            </Button>
            <CustomMenu
              ellipsis
              placement="bottom-end"
              closeOnSelect
              disabled={busy}
              aria-label="View actions"
              buttonClassName="size-[26px]"
            >
              {detail.canEdit && (
                <CustomMenu.MenuItem onClick={() => setEditor({ snapshot: detail })}>
                  <span className="flex items-center gap-2">
                    <EditIcon width={14} height={14} />
                    Edit View
                  </span>
                </CustomMenu.MenuItem>
              )}
              {detail.canFavorite && (
                <CustomMenu.MenuItem
                  onClick={() =>
                    void command(() => favorite({ viewId: detail.view._id, favorite: !detail.isFavorite }))
                  }
                >
                  {detail.isFavorite ? "Remove from favorites" : "Add to favorites"}
                </CustomMenu.MenuItem>
              )}
              <CustomMenu.MenuItem onClick={() => window.open(path, "_blank")}>
                <span className="flex items-center gap-2">
                  <NewTabIcon width={14} height={14} />
                  {t("open_in_new_tab")}
                </span>
              </CustomMenu.MenuItem>
              <CustomMenu.MenuItem
                onClick={() =>
                  void command(async () => {
                    await copyUrlToClipboard(path);
                    setToast({
                      type: TOAST_TYPE.SUCCESS,
                      title: "Link copied",
                      message: "View link copied to clipboard.",
                    });
                  })
                }
              >
                <span className="flex items-center gap-2">
                  <LinkIcon width={14} height={14} />
                  {t("copy_link")}
                </span>
              </CustomMenu.MenuItem>
              {(detail.canRemove || detail.canRestore) && (
                <CustomMenu.MenuItem
                  onClick={() => {
                    setError("");
                    setLifecycle(detail);
                  }}
                >
                  <span className="flex items-center gap-2">
                    <TrashIcon width={14} height={14} />
                    {detail.canRestore ? "Restore View" : "Delete View"}
                  </span>
                </CustomMenu.MenuItem>
              )}
            </CustomMenu>
          </Header.RightItem>
        </Header>
      </Row>
      <ContentWrapper>
        {detail.view.description && (
          <p className="border-b border-subtle px-5 py-3 text-13 whitespace-pre-wrap text-secondary">
            {detail.view.description}
          </p>
        )}
        {detail.view.deletedAt === null ? (
          <>
            <ViewPreviewControls
              canEdit={detail.canEdit}
              displayFilters={displayFilters}
              displayProperties={displayProperties}
              referenceFilters={
                <WorkspaceReferenceFilters
                  workspaceId={workspace._id}
                  filter={filter}
                  selections={detail.selections}
                  disabled={busy}
                />
              }
              busy={busy}
              pending={pending}
              dirty={dirty}
              canCreate
              onChange={change}
              onDiscard={() => {
                if (!isSubmitting) discardPreview();
              }}
              onSaveAs={() =>
                void command(async () => {
                  const { workspaceId: _workspaceId, ...definition } = input;
                  setEditor({
                    seed: {
                      input: {
                        ...definition,
                        filters: taskExpression.parse(filter.expression),
                        name: `${input.name} 2`,
                      },
                      logo: detail.logo,
                    },
                  });
                })
              }
              onUpdate={() =>
                void command(async () => {
                  const { workspaceId: _workspaceId, ...definition } = input;
                  await update({
                    ...definition,
                    filters: taskExpression.parse(filter.expression),
                    viewId: detail.view._id,
                    expectedUpdatedAt: (preview?.snapshot ?? filterSnapshot.current).view.updatedAt,
                  });
                  release(discardPreview);
                })
              }
            />
            {parsedFilters.success ? (
              <ViewBoundary key={JSON.stringify([parsedFilters.data, displayFilters])} onBack={discardPreview}>
                <WorkspaceResults
                  viewId={detail.view._id}
                  workspace={workspace}
                  filters={parsedFilters.data}
                  displayFilters={displayFilters}
                  displayProperties={displayProperties}
                />
              </ViewBoundary>
            ) : (
              <p role="alert" className="p-5 text-13 text-danger-primary">
                Complete each filter before previewing or saving this view.
              </p>
            )}
          </>
        ) : (
          <p className="p-5 text-13 text-secondary">This view is in Trash. Restore it to see matching work items.</p>
        )}
        {error && (
          <p role="alert" className="p-5 text-13 text-danger-primary">
            {error}
          </p>
        )}
      </ContentWrapper>
      <WorkspaceDefinitionCommand
        editor={editor}
        workspaceId={workspace._id}
        canEdit={detail.canEdit}
        onClose={() => setEditor(null)}
        onCreated={(id) =>
          release((allowNavigation) => {
            setPreview(null);
            if (allowNavigation) onCreated(id);
          })
        }
      />
      <ViewLifecycleCommand
        lifecycle={lifecycle}
        pending={pending}
        error={error}
        onClose={() => setLifecycle(null)}
        onSubmit={() =>
          void command(async () => {
            if (!lifecycle) return;
            const deleted = !lifecycle.canRestore;
            await remove({ viewId: lifecycle.view._id, expectedUpdatedAt: lifecycle.view.updatedAt, deleted });
            release((allowNavigation) => {
              setLifecycle(null);
              if (allowNavigation) onLifecycle(deleted);
            });
          })
        }
      />
      <TaskPeek workspaceSlug={workspace.slug} />
      <Button variant="ghost" className="sr-only focus:not-sr-only" disabled={busy} onClick={onBack}>
        Back to workspace views
      </Button>
    </div>
  );
});
function WorkspaceDefinitionCommand({
  editor,
  workspaceId,
  canEdit,
  onClose,
  onCreated,
}: {
  editor: { snapshot: Detail } | { seed?: NonNullable<ComponentProps<typeof WorkspaceViewForm>["createSeed"]> } | null;
  workspaceId: Id<"workspaces">;
  canEdit: boolean;
  onClose: () => void;
  onCreated: (id: Id<"savedViews">) => void;
}) {
  return (
    <SavedViewEditor isOpen={editor !== null} onClose={onClose}>
      {(onPendingChange) =>
        editor && (
          <WorkspaceViewForm
            key={"snapshot" in editor ? "edit" : editor.seed ? "copy" : "create"}
            workspaceId={workspaceId}
            initial={"snapshot" in editor ? editor.snapshot : null}
            createSeed={"snapshot" in editor ? undefined : editor.seed}
            canEdit={!("snapshot" in editor) || canEdit}
            onPendingChange={onPendingChange}
            onCancel={onClose}
            onDone={(id) => {
              onClose();
              if (!("snapshot" in editor)) onCreated(id);
            }}
          />
        )
      }
    </SavedViewEditor>
  );
}
function WorkspaceFavorite({ detail }: { detail: Pick<Detail, "view" | "canFavorite" | "isFavorite"> }) {
  const save = useMutation(api.savedViews.workspace.favorite);
  return <FavoriteControl detail={detail} onChange={(favorite) => save({ viewId: detail.view._id, favorite })} />;
}
function WorkspaceResults({
  viewId,
  workspace,
  filters,
  displayFilters,
  displayProperties,
}: {
  viewId: Id<"savedViews">;
  workspace: Pick<Workspace, "_id" | "slug">;
  filters: FunctionArgs<typeof api.savedViews.workspace.results>["filters"];
  displayFilters: Detail["view"]["displayFilters"];
  displayProperties: Detail["view"]["displayProperties"];
}) {
  const rows = usePaginatedQuery(
    api.savedViews.workspace.results,
    { viewId, filters, displayFilters },
    { initialNumItems: 50 }
  );
  return (
    <section className="min-h-0 flex-1 overflow-auto">
      <WorkspaceViewLayoutRoot
        rows={rows.results}
        workspace={workspace}
        displayFilters={displayFilters}
        displayProperties={displayProperties}
        cohortComplete={rows.status === "Exhausted"}
      />
      {rows.status === "CanLoadMore" && (
        <Button variant="secondary" className="m-4" onClick={() => rows.loadMore(50)}>
          Load more work items
        </Button>
      )}
      {(rows.status === "LoadingFirstPage" || rows.status === "LoadingMore") && (
        <p role="status" className="p-5">
          Loading matching work items…
        </p>
      )}
      {rows.status === "Exhausted" && !rows.results.length && (
        <p className="p-5 text-13 text-secondary">No matching work items.</p>
      )}
    </section>
  );
}
