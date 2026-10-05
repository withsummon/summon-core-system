import { Component, useState } from "react";
import type { ReactNode, ComponentProps } from "react";
import { Link, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Popover } from "@plane/propel/popover";
import { mutationMessage } from "../commercial/forms";
import { taskStatusOptions } from "../tasks/options";
import { ProjectReferenceFilters, SavedViewForm, ViewDisplayFields } from "./form";
import { BasicFilters } from "./filters";
import { AlertModalCore } from "@plane/ui";
import { copyUrlToClipboard } from "@plane/utils";
import { PageHead } from "@/components/core/page-title";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { SavedViewEditor } from "@/app/(all)/[workspaceSlug]/(projects)/workspace-views/page";
import { ProjectViewIssuesHeader } from "@/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/views/(detail)/[viewId]/header";
import { CreateProjectIssue, TaskPeek } from "../tasks/task-detail";
import { ProjectViewLayoutRoot } from "@/components/issues/issue-layouts/roots/project-view-layout-root";
import useReloadConfirmations, { useReloadSubmitting } from "@/hooks/use-reload-confirmation";
type Project = FunctionReturnType<typeof api.projects.index.list>[number];
type Detail =
  | FunctionReturnType<typeof api.savedViews.index.get>
  | FunctionReturnType<typeof api.savedViews.workspace.get>;
export function SavedViews({ project }: { project: Project }) {
  const [params, setParams] = useSearchParams();
  const selected = params.get("savedView");
  const tab =
    params.get("savedViewTab") === "trash" ? "trash" : params.get("savedViewTab") === "favorites" ? "favorites" : "all";
  const [creating, setCreating] = useState(false);
  const access = useQuery(api.savedViews.index.access, { projectId: project._id });
  const all = usePaginatedQuery(
    api.savedViews.index.list,
    selected || creating || tab === "favorites" ? "skip" : { projectId: project._id, deleted: tab === "trash" },
    { initialNumItems: 30 }
  );
  const favorites = usePaginatedQuery(
    api.savedViews.favorites.list,
    selected || creating || tab !== "favorites" ? "skip" : { projectId: project._id },
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
  if (creating && access?.canCreate)
    return <SavedViewForm projectId={project._id} initial={null} onDone={select} onCancel={() => setCreating(false)} />;
  if (selected)
    return (
      <ViewBoundary key={selected} onBack={() => select(null)}>
        <SavedViewDetail
          workspaceId={project.workspaceId}
          projectId={project._id}
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
          <h2 className="text-24 font-semibold">Saved views</h2>
          <p className="mt-1 text-14 text-secondary">Open a saved set of project task filters.</p>
        </div>
        {access?.canCreate && <Button onClick={() => setCreating(true)}>Create view</Button>}
      </header>
      <nav aria-label="Saved view lists" className="flex flex-wrap gap-2">
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
            <Favorite detail={row} />
          </li>
        ))}
      </ul>
      {rows.status === "LoadingFirstPage" && <p role="status">Loading saved views…</p>}
      {rows.status === "Exhausted" && !rows.results.length && (
        <p className="text-14 text-secondary">No saved views available in this list.</p>
      )}
      {rows.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => rows.loadMore(30)}>
          Load more views
        </Button>
      )}
    </section>
  );
}
export function SavedViewDetail({
  workspaceId,
  projectId,
  rawId,
  onBack,
  onLifecycle,
  onCreated,
}: {
  workspaceId: Id<"workspaces">;
  projectId: string;
  rawId: string;
  onBack: () => void;
  onLifecycle: (deleted: boolean) => void;
  onCreated: (id: Id<"savedViews">) => void;
}) {
  const address = useQuery(api.navigation.address.resolveProjectId, { workspaceId, projectId });
  const features = useQuery(api.projects.features.resolve, { workspaceId, projectId });
  const detail = useQuery(api.savedViews.index.resolve, { viewId: rawId });
  if (!address || !features || !detail)
    return (
      <p role="status" className="p-5">
        Opening saved view…
      </p>
    );
  if (detail.view.projectId !== address.project._id) throw new Error("Saved view belongs to another project.");
  return (
    <ProjectViewDetail
      address={address}
      features={features}
      detail={detail}
      onBack={onBack}
      onLifecycle={onLifecycle}
      onCreated={onCreated}
    />
  );
}
function ProjectViewDetail({
  address,
  features,
  detail,
  onBack,
  onLifecycle,
  onCreated,
}: {
  address: FunctionReturnType<typeof api.navigation.address.resolveProjectId>;
  features: FunctionReturnType<typeof api.projects.features.resolve>;
  detail: FunctionReturnType<typeof api.savedViews.index.resolve>;
  onBack: () => void;
  onLifecycle: (deleted: boolean) => void;
  onCreated: (id: Id<"savedViews">) => void;
}) {
  const [preview, setPreview] = useState<{
    snapshot: typeof detail;
    input: FunctionArgs<typeof api.savedViews.index.create> &
      Pick<(typeof detail)["view"], "displayFilters" | "displayProperties">;
  } | null>(null);
  const [editor, setEditor] = useState<
    { snapshot: typeof detail } | { seed: NonNullable<ComponentProps<typeof SavedViewForm>["createSeed"]> } | null
  >(null);
  const [lifecycle, setLifecycle] = useState<typeof detail | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const isSubmitting = useReloadSubmitting();
  const update = useMutation(api.savedViews.index.update);
  const remove = useMutation(api.savedViews.index.lifecycle);
  const favorite = useMutation(api.savedViews.favorites.set);
  const access = useQuery(api.savedViews.index.access, { projectId: address.project._id });
  const states = useQuery(api.tasks.states.list, { projectId: address.project._id });
  const input = preview
    ? preview.input
    : {
        projectId: address.project._id,
        name: detail.view.name,
        description: detail.view.description,
        filters: detail.view.filters,
        displayFilters: detail.view.displayFilters,
        displayProperties: detail.view.displayProperties,
        access: detail.view.access,
        logoProps: detail.view.logoProps,
      };
  const displayFilters = input.displayFilters;
  const displayProperties = input.displayProperties;
  const dirty =
    preview !== null &&
    JSON.stringify([input.filters, displayFilters, displayProperties]) !==
      JSON.stringify([
        preview.snapshot.view.filters,
        preview.snapshot.view.displayFilters,
        preview.snapshot.view.displayProperties,
      ]);
  const release = useReloadConfirmations(dirty, "This view has unsaved changes.", () => setPreview(null), pending);
  const command = async (operation: () => Promise<unknown>) => {
    if (pending || isSubmitting) return;
    setPending(true);
    setError("");
    try {
      await operation();
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  };
  const change = (
    criteria: Pick<NonNullable<typeof preview>["input"], "filters" | "displayFilters" | "displayProperties">
  ) => {
    if (!isSubmitting) setPreview({ snapshot: preview?.snapshot ?? detail, input: { ...input, ...criteria } });
  };
  const busy = pending || isSubmitting || editor !== null || lifecycle !== null;
  const path = `/${address.workspace.slug}/projects/${address.project._id}/views/${detail.view._id}/`;
  const canCreateTask =
    features.features.views &&
    address.workspaceRole !== "guest" &&
    address.projectRole !== "guest" &&
    detail.view.deletedAt === null;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHead title={`${address.project.name} - ${detail.view.name}`} />
      <ProjectViewIssuesHeader
        address={address}
        detail={detail}
        pending={busy}
        onEdit={() => setEditor({ snapshot: detail })}
        onFavorite={() => void command(() => favorite({ viewId: detail.view._id, favorite: !detail.isFavorite }))}
        onLifecycle={() => {
          setError("");
          setLifecycle(detail);
        }}
        onCopy={() => void command(() => copyUrlToClipboard(path))}
        onCreateTask={canCreateTask ? () => setCreatingTask(true) : undefined}
      />
      <ContentWrapper>
        {detail.view.description && (
          <p className="px-5 py-3 text-13 whitespace-pre-wrap text-secondary">{detail.view.description}</p>
        )}
        {!features.features.views ? (
          <section className="space-y-3 p-5">
            <h2 className="text-20 font-semibold">Views are disabled</h2>
            <Link to={`/${address.workspace.slug}/settings/projects/${address.project._id}/features/views/`}>
              Configure Views
            </Link>
          </section>
        ) : detail.view.deletedAt !== null ? (
          <p className="p-5 text-13 text-secondary">This view is in Trash. Restore it to open matching work items.</p>
        ) : (
          <>
            <ViewPreviewControls
              canEdit={detail.canEdit}
              filters={input.filters}
              referenceFilters={
                <ProjectReferenceFilters
                  projectId={detail.view.projectId}
                  filters={input.filters}
                  selections={detail.selections}
                  onChange={(filters) => change({ filters, displayFilters, displayProperties })}
                />
              }
              displayFilters={displayFilters}
              displayProperties={displayProperties}
              busy={busy}
              pending={pending}
              dirty={dirty}
              canCreate={!!access?.canCreate}
              onChange={change}
              onDiscard={() => {
                if (!isSubmitting) setPreview(null);
              }}
              onSaveAs={() => {
                const { projectId: _projectId, ...definition } = input;
                setEditor({ seed: { input: { ...definition, name: `${input.name} 2` }, logo: detail.logo } });
              }}
              onUpdate={() =>
                void command(async () => {
                  if (!preview) return;
                  const { projectId: _projectId, ...definition } = preview.input;
                  await update({
                    ...definition,
                    viewId: detail.view._id,
                    expectedUpdatedAt: preview.snapshot.view.updatedAt,
                  });
                  release(() => setPreview(null));
                })
              }
            />
            <ViewBoundary key={JSON.stringify([input.filters, displayFilters])} onBack={() => setPreview(null)}>
              <Results
                viewId={detail.view._id}
                address={address}
                filters={input.filters}
                displayFilters={displayFilters}
                displayProperties={displayProperties}
              />
            </ViewBoundary>
          </>
        )}
        {error && (
          <p role="alert" className="p-5 text-13 text-danger-primary">
            {error}
          </p>
        )}
      </ContentWrapper>
      <ViewDefinitionCommand
        editor={editor}
        projectId={address.project._id}
        canEdit={features.features.views && detail.canEdit}
        canCreate={features.features.views && !!access?.canCreate}
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
      <TaskPeek workspaceSlug={address.workspace.slug} />
      {creatingTask && states && (
        <CreateProjectIssue
          address={address}
          states={states}
          canCreate={canCreateTask}
          onClose={() => setCreatingTask(false)}
        />
      )}
      <Button variant="ghost" className="sr-only focus:not-sr-only" onClick={onBack}>
        Back to saved views
      </Button>
    </div>
  );
}
export function ViewLifecycleCommand({
  lifecycle,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  lifecycle: Detail | null;
  pending: boolean;
  error: string;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const restore = lifecycle?.canRestore;
  return (
    <AlertModalCore
      isOpen={lifecycle !== null}
      isSubmitting={pending}
      handleClose={() => {
        if (!pending) onClose();
      }}
      title={restore ? "Restore view?" : "Delete view?"}
      variant={restore ? "primary" : "danger"}
      primaryButtonText={{ default: restore ? "Restore" : "Delete", loading: "Saving" }}
      content={
        <>
          Its work items stay unchanged.
          {error && (
            <p role="alert" className="text-danger-primary">
              {error}
            </p>
          )}
        </>
      }
      handleSubmit={onSubmit}
    />
  );
}
function ViewDefinitionCommand({
  editor,
  projectId,
  canEdit,
  canCreate,
  onClose,
  onCreated,
}: {
  editor:
    | { snapshot: FunctionReturnType<typeof api.savedViews.index.resolve> }
    | { seed: NonNullable<ComponentProps<typeof SavedViewForm>["createSeed"]> }
    | null;
  projectId: Id<"projects">;
  canEdit: boolean;
  canCreate: boolean;
  onClose: () => void;
  onCreated: (id: Id<"savedViews">) => void;
}) {
  return (
    <SavedViewEditor isOpen={editor !== null} onClose={onClose}>
      {(onPendingChange) =>
        editor && (
          <SavedViewForm
            key={"snapshot" in editor ? "edit" : "copy"}
            projectId={projectId}
            initial={"snapshot" in editor ? editor.snapshot : null}
            createSeed={"seed" in editor ? editor.seed : undefined}
            canEdit={"snapshot" in editor ? canEdit : canCreate}
            onPendingChange={onPendingChange}
            onDone={(id) => {
              onClose();
              if ("seed" in editor) onCreated(id);
            }}
            onCancel={onClose}
          />
        )
      }
    </SavedViewEditor>
  );
}
export function ViewPreviewControls({
  canEdit,
  filters,
  referenceFilters,
  displayFilters,
  displayProperties,
  busy,
  pending,
  dirty,
  canCreate,
  onChange,
  onUpdate,
  onSaveAs,
  onDiscard,
}: {
  canEdit: boolean;
  filters: FunctionArgs<typeof api.savedViews.index.create>["filters"];
  referenceFilters: ReactNode;
  displayFilters: NonNullable<FunctionArgs<typeof api.savedViews.index.create>["displayFilters"]>;
  displayProperties: NonNullable<FunctionArgs<typeof api.savedViews.index.create>["displayProperties"]>;
  busy: boolean;
  pending: boolean;
  dirty: boolean;
  canCreate: boolean;
  onChange: (
    criteria: Pick<FunctionArgs<typeof api.savedViews.index.create>, "filters"> &
      Pick<FunctionReturnType<typeof api.savedViews.index.resolve>["view"], "displayFilters" | "displayProperties">
  ) => void;
  onUpdate: () => void;
  onSaveAs: () => void;
  onDiscard: () => void;
}) {
  return (
    <section className="flex flex-wrap items-center gap-2 border-b border-subtle px-5 py-2">
      <Popover>
        <Popover.Button disabled={busy} className="rounded px-2 py-1 text-13 hover:bg-layer-1">
          Display
        </Popover.Button>
        <Popover.Panel
          placement="bottom-start"
          className="shadow-lg max-h-[80vh] w-96 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-md border border-subtle bg-surface-1 p-4"
        >
          <fieldset disabled={busy}>
            <ViewDisplayFields
              displayFilters={displayFilters}
              displayProperties={displayProperties}
              disabled={busy}
              onChange={(display) => onChange({ filters, ...display })}
            />
          </fieldset>
        </Popover.Panel>
      </Popover>
      <Popover>
        <Popover.Button disabled={busy} className="rounded px-2 py-1 text-13 hover:bg-layer-1">
          Filters
        </Popover.Button>
        <Popover.Panel
          placement="bottom-start"
          className="shadow-lg max-h-[80vh] w-96 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-md border border-subtle bg-surface-1 p-4"
        >
          <fieldset disabled={busy}>
            <BasicFilters
              filters={filters}
              onChange={(nextFilters) => onChange({ filters: nextFilters, displayFilters, displayProperties })}
            />
            {referenceFilters}
          </fieldset>
        </Popover.Panel>
      </Popover>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" loading={pending} disabled={!dirty || !canEdit || busy} onClick={onUpdate}>
          Update view
        </Button>
        <Button size="sm" variant="secondary" disabled={busy || !canCreate} onClick={onSaveAs}>
          Save as
        </Button>
        {dirty && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={onDiscard}>
            Discard preview
          </Button>
        )}
      </div>
    </section>
  );
}
function selectionNames(items: { id: string; name: string | null }[], ids: string[]) {
  return ids.map((id) => items.find((item) => item.id === id)?.name ?? "Unavailable selection").join(", ");
}
export function SavedFilters({ detail }: { detail: Detail }) {
  const filters = detail.view.filters;
  const groups = [
    filters.statuses.length
      ? `Status: ${filters.statuses.map((status) => taskStatusOptions[status].label).join(", ")}`
      : null,
    filters.priorities.length ? `Priority: ${filters.priorities.join(", ")}` : null,
    filters.stateIds.length ? `State: ${selectionNames(detail.selections.states, filters.stateIds)}` : null,
    filters.labelIds.length ? `Label: ${selectionNames(detail.selections.labels, filters.labelIds)}` : null,
    filters.assigneeIds.length ? `Assignee: ${selectionNames(detail.selections.users, filters.assigneeIds)}` : null,
    filters.creatorIds.length ? `Creator: ${selectionNames(detail.selections.users, filters.creatorIds)}` : null,
    filters.startDate ? `Start: ${filters.startDate.from ?? "Any"} → ${filters.startDate.to ?? "Any"}` : null,
    filters.targetDate ? `Target: ${filters.targetDate.from ?? "Any"} → ${filters.targetDate.to ?? "Any"}` : null,
  ].filter((value) => value !== null);
  return (
    <details className="rounded-md border border-subtle-1 p-3">
      <summary className="cursor-pointer text-14 font-medium">
        {groups.length ? `Match ${filters.match} filter groups` : "All active tasks in this view’s scope"}
      </summary>
      <ul className="mt-2 space-y-1 text-14 text-secondary">
        {groups.map((group) => (
          <li key={group}>{group}</li>
        ))}
      </ul>
    </details>
  );
}
function Results({
  viewId,
  address,
  filters,
  displayFilters,
  displayProperties,
}: {
  viewId: Id<"savedViews">;
  address: FunctionReturnType<typeof api.navigation.address.resolveProjectId>;
  filters: FunctionArgs<typeof api.savedViews.results.list>["filters"];
  displayFilters: NonNullable<FunctionArgs<typeof api.savedViews.results.list>["displayFilters"]>;
  displayProperties: NonNullable<FunctionArgs<typeof api.savedViews.index.create>["displayProperties"]>;
}) {
  const rows = usePaginatedQuery(
    api.savedViews.results.list,
    { viewId, filters, displayFilters },
    { initialNumItems: 50 }
  );
  return (
    <section>
      <ProjectViewLayoutRoot
        tasks={rows.results}
        address={address}
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
      {rows.status === "Exhausted" && rows.results.length === 0 && (
        <p className="p-5 text-13 text-secondary">No matching work items.</p>
      )}
    </section>
  );
}
function Favorite({ detail }: { detail: Pick<Detail, "view" | "canFavorite" | "isFavorite"> }) {
  const save = useMutation(api.savedViews.favorites.set);
  return <FavoriteControl detail={detail} onChange={(favorite) => save({ viewId: detail.view._id, favorite })} />;
}
export function FavoriteControl({
  detail,
  onChange,
}: {
  detail: Pick<Detail, "view" | "canFavorite" | "isFavorite">;
  onChange: (favorite: boolean) => Promise<unknown>;
}) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  if (!detail.canFavorite) return null;
  return (
    <div className="space-y-1">
      <Button
        variant="secondary"
        aria-pressed={detail.isFavorite}
        loading={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            await onChange(!detail.isFavorite);
          } catch (failure) {
            setError(mutationMessage(failure));
          } finally {
            setPending(false);
          }
        }}
      >
        {detail.isFavorite ? "Unfavorite" : "Favorite"}
      </Button>
      {error && (
        <p role="alert" className="text-12 text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}
export function ViewLifecycleControl({
  detail,
  onDone,
  onChange,
}: {
  detail: Detail;
  onDone: (deleted: boolean) => void;
  onChange: (args: FunctionArgs<typeof api.savedViews.index.lifecycle>) => Promise<unknown>;
}) {
  const [snapshot, setSnapshot] = useState<Detail | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  if (!detail.canRemove && !detail.canRestore) return null;
  return (
    <section className="space-y-3 border-t border-subtle-1 pt-4">
      {snapshot ? (
        <>
          <p className="text-14">
            {snapshot.canRestore
              ? "Restore this saved view definition?"
              : "Move this view to Trash? Its tasks stay unchanged."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              loading={pending}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  const deleted = !snapshot.canRestore;
                  await onChange({ viewId: snapshot.view._id, expectedUpdatedAt: snapshot.view.updatedAt, deleted });
                  onDone(deleted);
                } catch (failure) {
                  setError(mutationMessage(failure));
                } finally {
                  setPending(false);
                }
              }}
            >
              {snapshot.canRestore ? "Confirm restore view" : "Confirm remove view"}
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setSnapshot(null)}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <Button
          variant="secondary"
          onClick={() => {
            setSnapshot(detail);
            setError("");
          }}
        >
          {detail.canRestore ? "Restore view" : "Remove view"}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </section>
  );
}
export class ViewBoundary extends Component<{ children: ReactNode; onBack: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section className="space-y-3">
        <h2 className="text-20 font-semibold">This saved view is unavailable</h2>
        <Button variant="secondary" onClick={this.props.onBack}>
          Back to saved views
        </Button>
      </section>
    ) : (
      this.props.children
    );
  }
}
