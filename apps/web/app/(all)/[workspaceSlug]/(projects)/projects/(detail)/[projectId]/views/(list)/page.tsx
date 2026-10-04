import { useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { DATE_BEFORE_FILTER_OPTIONS } from "@plane/constants";
import { Button } from "@plane/propel/button";
import { ViewsIcon } from "@plane/propel/icons";
import { copyUrlToClipboard, getDate } from "@plane/utils";
import { AlertModalCore, Row } from "@plane/ui";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { PageHead } from "@/components/core/page-title";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { SavedViewForm } from "@/components/convex-core/saved-views/form";
import { ViewBoundary } from "@/components/convex-core/saved-views/saved-views";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { SavedViewEditor, SavedViewListItem } from "../../../../../workspace-views/page";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { ProjectViewsHeader } from "./header";

type ViewRow = FunctionReturnType<typeof api.savedViews.index.list>["page"][number];
export default function ProjectViewsPage() {
  const session = useOutletContext<WorkspaceSession>();
  const { projectId = "" } = useParams();
  const project = useQuery(api.projects.features.resolve, { workspaceId: session.workspace._id, projectId });
  if (!project)
    return (
      <p role="status" className="p-5">
        Opening project views…
      </p>
    );
  return (
    <ViewBoundary key={project.projectId} onBack={() => window.history.back()}>
      <ProjectViewList project={project} session={session} />
    </ViewBoundary>
  );
}

function ProjectViewList({
  project,
  session,
}: {
  project: FunctionReturnType<typeof api.projects.features.resolve>;
  session: WorkspaceSession;
}) {
  const navigate = useNavigate();
  const path = `/${session.workspace.slug}/projects/${project.projectId}/views/`;
  const [criteria, setCriteria] = useState<
    Omit<FunctionArgs<typeof api.savedViews.index.list>, "projectId" | "paginationOpts">
  >({ deleted: false, orderBy: "updated_at", order: "desc" });
  const [dates, setDates] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Id<"savedViews"> | null>(null);
  const [deleting, setDeleting] = useState<ViewRow | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const edited = useQuery(api.savedViews.index.get, editing ? { viewId: editing } : "skip");
  const access = useQuery(api.savedViews.index.access, { projectId: project.projectId });
  const members = useQuery(api.projects.index.members, { projectId: project.projectId });
  const views = usePaginatedQuery(
    api.savedViews.index.list,
    { projectId: project.projectId, ...criteria },
    { initialNumItems: 30 }
  );
  const lifecycle = useMutation(api.savedViews.index.lifecycle);
  const favorite = useMutation(api.savedViews.favorites.set);
  useReloadConfirmations(false, "A view command is still being saved.", undefined, pending);
  const command = async (operation: () => Promise<unknown>) => {
    if (pending) return;
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
  const closeForm = () => {
    setCreating(false);
    setEditing(null);
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHead title={`${project.name} - Views`} />
      <Row className="z-[18] flex min-h-11 shrink-0 items-center border-b border-subtle bg-surface-1">
        <ProjectViewsHeader
          project={project}
          path={path}
          criteria={criteria}
          onChange={setCriteria}
          dates={dates}
          members={members?.members ?? []}
          onCreate={() => setCreating(true)}
          onDates={(value) => {
            const selected = new Set(dates);
            for (const item of Array.isArray(value) ? value : [value]) {
              if (selected.has(item)) selected.delete(item);
              else selected.add(item);
            }
            const next = [...selected];
            setDates(next);
            setCriteria({
              ...criteria,
              createdAt: next.map((item) => {
                const [date, operator, from] = item.split(";");
                if (from === "fromnow") {
                  if (!DATE_BEFORE_FILTER_OPTIONS.some((option) => option.value === item))
                    throw new Error("Created date selection is invalid.");
                  const days = Number(date.split("_")[0]) * (date.endsWith("_weeks") ? 7 : 30);
                  const cutoff = new Date();
                  cutoff.setHours(23, 59, 59, 999);
                  cutoff.setDate(cutoff.getDate() - days);
                  return { before: true, timestamp: cutoff.getTime() };
                }
                const selectedDate = getDate(date);
                if (!selectedDate) throw new Error("Created date selection is invalid.");
                return { before: operator === "before", timestamp: selectedDate.getTime() };
              }),
            });
          }}
        />
      </Row>
      <ContentWrapper>
        {!project.features.views ? (
          <div className="grid h-full place-content-center gap-3 p-5 text-center">
            <h2 className="text-20 font-semibold">Views are disabled</h2>
            <p className="text-13 text-secondary">Enable Views in this project’s feature settings.</p>
            {project.canConfigure && (
              <Link
                to={`/${session.workspace.slug}/settings/projects/${project.projectId}/features/views/`}
                className="text-accent-primary"
              >
                Configure Views
              </Link>
            )}
          </div>
        ) : (
          <ProjectViewRows
            views={views}
            path={path}
            criteria={criteria}
            dates={dates}
            pending={pending}
            onEdit={setEditing}
            onRemove={(row) => {
              setError("");
              setDeleting(row);
            }}
            onFavorite={(args) => void command(() => favorite(args))}
            onCopy={(href) =>
              void command(async () => {
                await copyUrlToClipboard(href);
                setToast({ type: TOAST_TYPE.SUCCESS, title: "Link copied", message: "View link copied to clipboard." });
              })
            }
            onClear={() => {
              setDates([]);
              setCriteria({ ...criteria, favorites: false, ownerIds: [], createdAt: [] });
            }}
          />
        )}
        {error && !deleting && (
          <p role="alert" className="px-5 py-2 text-13 text-danger-primary">
            {error}
          </p>
        )}
      </ContentWrapper>
      <SavedViewEditor isOpen={creating || editing !== null} onClose={closeForm}>
        {(onPendingChange) => (
          <>
            {creating && (
              <SavedViewForm
                projectId={project.projectId}
                initial={null}
                canEdit={!!access?.canCreate && project.features.views}
                onPendingChange={onPendingChange}
                onDone={(id) => navigate(`${path}${id}/`)}
                onCancel={closeForm}
              />
            )}
            {editing &&
              (edited ? (
                <SavedViewForm
                  key={editing}
                  projectId={project.projectId}
                  initial={edited}
                  canEdit={edited.canEdit && project.features.views}
                  onPendingChange={onPendingChange}
                  onDone={closeForm}
                  onCancel={closeForm}
                />
              ) : (
                <p role="status">Opening view…</p>
              ))}
          </>
        )}
      </SavedViewEditor>
      <AlertModalCore
        isOpen={deleting !== null}
        isSubmitting={pending}
        handleClose={() => {
          if (!pending) setDeleting(null);
        }}
        title={deleting?.canRestore ? "Restore view?" : "Delete view?"}
        variant={deleting?.canRestore ? "primary" : "danger"}
        content={
          <>
            <span>
              {deleting?.canRestore
                ? "This view will return to active lists."
                : "This view will leave active lists. Its work items stay unchanged."}
            </span>
            {error && (
              <p role="alert" className="mt-2 text-danger-primary">
                {error}
              </p>
            )}
          </>
        }
        handleSubmit={async () => {
          if (!deleting || pending) return;
          await command(async () => {
            await lifecycle({
              viewId: deleting.view._id,
              expectedUpdatedAt: deleting.view.updatedAt,
              deleted: !deleting.canRestore,
            });
            setDeleting(null);
          });
        }}
      />
    </div>
  );
}

function ProjectViewRows({
  views,
  path,
  criteria,
  dates,
  pending,
  onEdit,
  onRemove,
  onFavorite,
  onCopy,
  onClear,
}: {
  views: ReturnType<typeof usePaginatedQuery<typeof api.savedViews.index.list>>;
  path: string;
  criteria: Omit<FunctionArgs<typeof api.savedViews.index.list>, "projectId" | "paginationOpts">;
  dates: string[];
  pending: boolean;
  onEdit: (id: Id<"savedViews">) => void;
  onRemove: (row: ViewRow) => void;
  onFavorite: (args: FunctionArgs<typeof api.savedViews.favorites.set>) => void;
  onCopy: (href: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="h-full overflow-y-auto bg-surface-1">
      {criteria.favorites || criteria.ownerIds?.length || dates.length ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-subtle px-5 py-2 text-11">
          <span>
            {criteria.favorites ? "Favorites · " : ""}
            {criteria.ownerIds?.length ? `${criteria.ownerIds.length} creators · ` : ""}
            {dates.length ? `${dates.length} created date filters` : ""}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onClear();
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : null}
      {views.results.map((row) => (
        <SavedViewListItem
          key={row.view._id}
          row={row}
          href={`${path}${row.view._id}/`}
          pending={pending}
          onEdit={() => onEdit(row.view._id)}
          onRemove={() => onRemove(row)}
          onFavorite={() => onFavorite({ viewId: row.view._id, favorite: !row.isFavorite })}
          onCopy={() => onCopy(`${path}${row.view._id}/`)}
        />
      ))}
      {views.status === "LoadingFirstPage" && (
        <p role="status" className="p-5 text-13">
          Loading project views…
        </p>
      )}
      {views.status === "Exhausted" && !views.results.length && (
        <div className="p-8 text-center text-13">
          <ViewsIcon className="mx-auto mb-3 size-8 text-tertiary" />
          <p>No views match this list.</p>
        </div>
      )}
      {views.status === "CanLoadMore" && (
        <Button variant="secondary" className="m-4" onClick={() => views.loadMore(30)}>
          Load more views
        </Button>
      )}
    </div>
  );
}
