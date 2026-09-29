import { useState } from "react";
import { Link, useNavigate, useOutletContext, useParams, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { EditIcon, LinkIcon, NewTabIcon, TrashIcon, ViewsIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { copyUrlToClipboard } from "@plane/utils";
import {
  AlertModalCore,
  Breadcrumbs,
  CustomMenu,
  EModalPosition,
  EModalWidth,
  Header,
  ModalCore,
  Row,
} from "@plane/ui";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { PageHead } from "@/components/core/page-title";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { SavedFilters, ViewBoundary } from "@/components/convex-core/saved-views/saved-views";
import { WorkspaceViewForm } from "@/components/convex-core/saved-views/workspace-form";
import { taskStatusOptions } from "@/components/convex-core/tasks/options";
import { TaskPeek } from "@/components/convex-core/tasks/task-detail";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import { usePlatformOS } from "@/hooks/use-platform-os";
import type { WorkspaceSession } from "./native-workspace";

export default function NativeWorkspaceViewDetail() {
  const session = useOutletContext<WorkspaceSession>();
  const commands = useStickiesCommands();
  const navigate = useNavigate();
  const { globalViewId = "" } = useParams();
  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
      <ViewBoundary key={globalViewId} onBack={() => navigate(`/${session.workspace.slug}/workspace-views/`)}>
        <ViewDetail session={session} rawId={globalViewId} />
      </ViewBoundary>
    </PreservedWorkspaceShell>
  );
}

function ViewDetail({ session, rawId }: { session: WorkspaceSession; rawId: string }) {
  const detail = useQuery(api.savedViews.workspace.resolve, { viewId: rawId });
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [lifecycleSnapshot, setLifecycleSnapshot] = useState<FunctionReturnType<
    typeof api.savedViews.workspace.resolve
  > | null>(null);
  const path = `/${session.workspace.slug}/workspace-views/${rawId}/`;
  if (detail && detail.view.workspaceId !== session.workspace._id)
    throw new Response("View does not belong to this workspace.", { status: 404 });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHead title={`${session.workspace.name} - ${detail?.view.name ?? "View"}`} />
      <Row className="z-[18] flex h-11 shrink-0 items-center border-b border-subtle bg-surface-1">
        <Header>
          <Header.LeftItem>
            <Breadcrumbs>
              <Breadcrumbs.Item
                component={<BreadcrumbLink label={t("views")} icon={<ViewsIcon className="h-4 w-4 text-tertiary" />} />}
              />
              {detail && (
                <Breadcrumbs.Item component={<span className="truncate text-13">{detail.view.name}</span>} isLast />
              )}
            </Breadcrumbs>
          </Header.LeftItem>
          <Header.RightItem className="items-center">
            <Button variant="primary" size="lg" onClick={() => setCreating(true)}>
              {t("workspace_views.add_view")}
            </Button>
            {detail && (
              <ViewActions
                detail={detail}
                path={path}
                onEdit={() => setEditing(true)}
                onLifecycle={() => {
                  setLifecycleSnapshot(detail);
                }}
              />
            )}
          </Header.RightItem>
        </Header>
      </Row>
      <ContentWrapper>
        {!detail ? (
          <p role="status" className="p-5 text-13">
            Opening workspace view…
          </p>
        ) : (
          <div className="flex h-full min-h-0 flex-col bg-surface-1">
            {detail.view.description && (
              <p className="border-b border-subtle px-5 py-3 text-13 whitespace-pre-wrap text-secondary">
                {detail.view.description}
              </p>
            )}
            <div className="border-b border-subtle p-3">
              <SavedFilters detail={detail} />
            </div>
            {detail.view.deletedAt === null ? (
              <ViewResults
                key={`${detail.view._id}:${detail.view.updatedAt}`}
                viewId={detail.view._id}
                workspaceSlug={session.workspace.slug}
              />
            ) : (
              <p className="p-5 text-13 text-secondary">
                This view is in Trash. Restore it to see matching work items.
              </p>
            )}
          </div>
        )}
      </ContentWrapper>
      <TaskPeek workspaceSlug={session.workspace.slug} />
      <ModalCore
        isOpen={creating || editing}
        handleClose={() => {
          setCreating(false);
          setEditing(false);
        }}
        position={EModalPosition.TOP}
        width={EModalWidth.XXL}
      >
        <div className="max-h-[80vh] overflow-y-auto p-5">
          {creating && (
            <WorkspaceViewForm
              workspaceId={session.workspace._id}
              initial={null}
              onDone={(id) => {
                setCreating(false);
                navigate(`/${session.workspace.slug}/workspace-views/${id}/`);
              }}
              onCancel={() => setCreating(false)}
            />
          )}
          {editing && detail && (
            <WorkspaceViewForm
              key={detail.view._id}
              workspaceId={session.workspace._id}
              initial={detail}
              onDone={() => setEditing(false)}
              onCancel={() => setEditing(false)}
            />
          )}
        </div>
      </ModalCore>
      {lifecycleSnapshot && (
        <ViewLifecycleDialog
          snapshot={lifecycleSnapshot}
          workspaceSlug={session.workspace.slug}
          onClose={() => setLifecycleSnapshot(null)}
        />
      )}
    </div>
  );
}

function ViewLifecycleDialog({
  snapshot,
  workspaceSlug,
  onClose,
}: {
  snapshot: FunctionReturnType<typeof api.savedViews.workspace.resolve>;
  workspaceSlug: string;
  onClose: () => void;
}) {
  const lifecycle = useMutation(api.savedViews.workspace.lifecycle);
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <AlertModalCore
      isOpen
      handleClose={onClose}
      handleSubmit={async () => {
        setPending(true);
        setError("");
        try {
          await lifecycle({
            viewId: snapshot.view._id,
            expectedUpdatedAt: snapshot.view.updatedAt,
            deleted: snapshot.canRemove,
          });
          onClose();
          if (snapshot.canRemove) navigate(`/${workspaceSlug}/workspace-views/`);
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
      isSubmitting={pending}
      title={snapshot.canRestore ? "Restore view?" : "Delete view?"}
      variant={snapshot.canRestore ? "primary" : "danger"}
      primaryButtonText={snapshot.canRestore ? { loading: "Restoring", default: "Restore" } : undefined}
      content={
        <>
          {snapshot.canRestore
            ? "This view will return to active lists."
            : "This view will leave active lists. Its work items stay unchanged."}
          {error && (
            <p role="alert" className="mt-2 text-danger-primary">
              {error}
            </p>
          )}
        </>
      }
    />
  );
}

function ViewActions({
  detail,
  path,
  onEdit,
  onLifecycle,
}: {
  detail: FunctionReturnType<typeof api.savedViews.workspace.resolve>;
  path: string;
  onEdit: () => void;
  onLifecycle: () => void;
}) {
  const favorite = useMutation(api.savedViews.workspace.favorite);
  const { t } = useTranslation();
  return (
    <CustomMenu ellipsis placement="bottom-end" closeOnSelect buttonClassName="size-[26px]">
      {detail.canEdit && (
        <CustomMenu.MenuItem onClick={onEdit}>
          <span className="flex items-center gap-2">
            <EditIcon width={14} height={14} />
            Edit View
          </span>
        </CustomMenu.MenuItem>
      )}
      {detail.canFavorite && (
        <CustomMenu.MenuItem
          onClick={async () => {
            try {
              await favorite({ viewId: detail.view._id, favorite: !detail.isFavorite });
            } catch (failure) {
              setToast({
                type: TOAST_TYPE.ERROR,
                title: "Could not update favorite",
                message: mutationMessage(failure),
              });
            }
          }}
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
        onClick={async () => {
          try {
            await copyUrlToClipboard(path);
            setToast({ type: TOAST_TYPE.SUCCESS, title: "Link copied", message: "View link copied to clipboard." });
          } catch {
            setToast({ type: TOAST_TYPE.ERROR, title: "Could not copy link", message: "Try again." });
          }
        }}
      >
        <span className="flex items-center gap-2">
          <LinkIcon width={14} height={14} />
          {t("copy_link")}
        </span>
      </CustomMenu.MenuItem>
      {(detail.canRemove || detail.canRestore) && (
        <CustomMenu.MenuItem onClick={onLifecycle}>
          <span className="flex items-center gap-2">
            <TrashIcon width={14} height={14} />
            {detail.canRestore ? "Restore View" : "Delete View"}
          </span>
        </CustomMenu.MenuItem>
      )}
    </CustomMenu>
  );
}

function ViewResults({ viewId, workspaceSlug }: { viewId: Id<"savedViews">; workspaceSlug: string }) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.savedViews.workspace.results,
    { viewId },
    { initialNumItems: 50 }
  );
  const [, setParams] = useSearchParams();
  const { isMobile } = usePlatformOS();
  return (
    <div className="min-h-0 overflow-auto">
      <table className="w-full min-w-[760px] bg-surface-1 text-left">
        <thead className="sticky top-0 z-10 border-b border-subtle bg-layer-1 text-13 font-medium">
          <tr>
            <th className="h-11 min-w-80 border-r border-subtle px-page-x font-medium">Work items</th>
            <th className="h-11 min-w-36 border-r border-subtle px-4 font-medium">Project</th>
            <th className="h-11 min-w-32 border-r border-subtle px-4 font-medium">State</th>
            <th className="h-11 min-w-28 border-r border-subtle px-4 font-medium">Priority</th>
            <th className="h-11 min-w-32 px-4 font-medium">Due date</th>
          </tr>
        </thead>
        <tbody>
          {results.map(({ task, project, state }) => {
            const identifier = `${project.identifier}-${task.sequence}`;
            return (
              <tr key={task._id} className="h-11 border-b border-subtle bg-surface-1 hover:bg-surface-2">
                <td className="min-w-80 border-r border-subtle px-page-x">
                  <Link
                    to={`/${workspaceSlug}/browse/${identifier}/`}
                    className="flex min-w-0 items-center gap-3 text-13 text-primary"
                    onClick={(event) => {
                      if (
                        isMobile ||
                        event.button !== 0 ||
                        event.metaKey ||
                        event.ctrlKey ||
                        event.shiftKey ||
                        event.altKey
                      )
                        return;
                      event.preventDefault();
                      setParams((current) => {
                        const next = new URLSearchParams(current);
                        next.set("peek", identifier);
                        return next;
                      });
                    }}
                  >
                    <span className="shrink-0 text-tertiary">{identifier}</span>
                    <span className="truncate">{task.title}</span>
                  </Link>
                </td>
                <td className="border-r border-subtle px-4 text-12">{project.name}</td>
                <td className="border-r border-subtle px-4 text-12">
                  {state?.name ?? taskStatusOptions[task.status].label}
                </td>
                <td className="border-r border-subtle px-4 text-12 capitalize">{task.priority}</td>
                <td className="px-4 text-12">{task.targetDate ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {status === "LoadingFirstPage" && (
        <p role="status" className="p-5 text-13">
          Loading matching work items…
        </p>
      )}
      {status === "Exhausted" && results.length === 0 && (
        <p className="p-8 text-center text-13">No matching work items.</p>
      )}
      {status === "CanLoadMore" && (
        <Button variant="secondary" className="m-4" onClick={() => loadMore(50)}>
          Load more work items
        </Button>
      )}
      {status === "LoadingMore" && (
        <p role="status" className="p-4 text-13">
          Loading more work items…
        </p>
      )}
    </div>
  );
}
