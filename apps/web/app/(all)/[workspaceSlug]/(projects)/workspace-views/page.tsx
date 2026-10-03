import { useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { DEFAULT_GLOBAL_VIEWS_LIST } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { EditIcon, LinkIcon, NewTabIcon, SearchIcon, TrashIcon, ViewsIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { copyUrlToClipboard } from "@plane/utils";
import {
  AlertModalCore,
  Breadcrumbs,
  CustomMenu,
  EModalPosition,
  EModalWidth,
  Header,
  Input,
  ModalCore,
  Row,
} from "@plane/ui";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { PageHead } from "@/components/core/page-title";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { WorkspaceViewForm } from "@/components/convex-core/saved-views/workspace-form";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import { GlobalDefaultViewListItem } from "@/components/workspace/views/default-view-list-item";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import type { WorkspaceSession } from "../../../../native-workspace";

type ViewRow = FunctionReturnType<typeof api.savedViews.workspace.list>["page"][number];

export default function WorkspaceViewsPage() {
  const session = useOutletContext<WorkspaceSession>();
  const commands = useStickiesCommands();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Id<"savedViews"> | null>(null);
  const [deleting, setDeleting] = useState<ViewRow | null>(null);
  const [deletingPending, setDeletingPending] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const edited = useQuery(api.savedViews.workspace.get, editing ? { viewId: editing } : "skip");
  const remove = useMutation(api.savedViews.workspace.lifecycle);
  const views = usePaginatedQuery(
    api.savedViews.workspace.list,
    { workspaceId: session.workspace._id, deleted: false, search },
    { initialNumItems: 30 }
  );

  const closeDelete = () => {
    setDeleting(null);
    setDeleteError("");
  };

  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
      <PageHead title={`${session.workspace.name} - All Views`} />
      <div className="flex h-full min-h-0 flex-col">
        <Row className="z-[18] flex h-11 shrink-0 items-center border-b border-subtle bg-surface-1">
          <Header>
            <Header.LeftItem>
              <Breadcrumbs>
                <Breadcrumbs.Item
                  component={
                    <BreadcrumbLink label={t("views")} icon={<ViewsIcon className="h-4 w-4 text-tertiary" />} />
                  }
                  isLast
                />
              </Breadcrumbs>
            </Header.LeftItem>
            <Header.RightItem>
              <Button variant="primary" size="lg" onClick={() => setCreating(true)}>
                {t("workspace_views.add_view")}
              </Button>
            </Header.RightItem>
          </Header>
        </Row>
        <ContentWrapper>
          <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-surface-1">
            <div className="flex h-11 shrink-0 items-center gap-2.5 border-b border-subtle px-5 py-3">
              <SearchIcon className="text-secondary" width={14} height={14} strokeWidth={2} />
              <Input
                aria-label="Search views"
                className="w-full bg-transparent !p-0 text-11 leading-5 text-secondary placeholder:text-placeholder focus:outline-none"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search"
                mode="true-transparent"
              />
            </div>
            <div className="vertical-scrollbar flex scrollbar-lg min-h-0 w-full flex-col overflow-y-auto">
              {DEFAULT_GLOBAL_VIEWS_LIST.filter((view) =>
                t(view.i18n_label).toLowerCase().includes(search.toLowerCase())
              ).map((view) => (
                <GlobalDefaultViewListItem key={view.key} view={view} />
              ))}
              {views.results.map((row) => (
                <div
                  key={row.view._id}
                  className="group flex min-h-[52px] items-center border-b border-subtle hover:bg-surface-2"
                >
                  <Link
                    to={`/${session.workspace.slug}/workspace-views/${row.view._id}/`}
                    className="flex min-w-0 flex-1 flex-col justify-center px-5 py-2"
                  >
                    <span className="truncate text-13 leading-4 font-medium">{row.view.name}</span>
                    {row.view.description && (
                      <span className="truncate text-11 text-secondary">{row.view.description}</span>
                    )}
                  </Link>
                  <CustomMenu ellipsis placement="bottom-end" closeOnSelect buttonClassName="mr-4 size-[26px]">
                    {row.canEdit && (
                      <CustomMenu.MenuItem onClick={() => setEditing(row.view._id)}>
                        <span className="flex items-center gap-2">
                          <EditIcon width={14} height={14} />
                          Edit View
                        </span>
                      </CustomMenu.MenuItem>
                    )}
                    <CustomMenu.MenuItem
                      onClick={() =>
                        window.open(`/${session.workspace.slug}/workspace-views/${row.view._id}/`, "_blank")
                      }
                    >
                      <span className="flex items-center gap-2">
                        <NewTabIcon width={14} height={14} />
                        {t("open_in_new_tab")}
                      </span>
                    </CustomMenu.MenuItem>
                    <CustomMenu.MenuItem
                      onClick={async () => {
                        try {
                          await copyUrlToClipboard(`/${session.workspace.slug}/workspace-views/${row.view._id}/`);
                          setToast({
                            type: TOAST_TYPE.SUCCESS,
                            title: "Link copied",
                            message: "View link copied to clipboard.",
                          });
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
                    {row.canRemove && (
                      <CustomMenu.MenuItem onClick={() => setDeleting(row)}>
                        <span className="flex items-center gap-2">
                          <TrashIcon width={14} height={14} />
                          Delete View
                        </span>
                      </CustomMenu.MenuItem>
                    )}
                  </CustomMenu>
                </div>
              ))}
              {views.status === "LoadingFirstPage" && (
                <p role="status" className="p-5 text-13">
                  Loading workspace views…
                </p>
              )}
              {views.status === "CanLoadMore" && (
                <Button variant="secondary" className="m-4 self-start" onClick={() => views.loadMore(30)}>
                  Load more views
                </Button>
              )}
            </div>
          </div>
        </ContentWrapper>
        <ModalCore
          isOpen={creating || editing !== null}
          handleClose={() => {
            setCreating(false);
            setEditing(null);
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
            {editing &&
              (edited ? (
                <WorkspaceViewForm
                  key={editing}
                  workspaceId={session.workspace._id}
                  initial={edited}
                  onDone={() => setEditing(null)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <p role="status">Opening workspace view…</p>
              ))}
          </div>
        </ModalCore>
        <AlertModalCore
          isOpen={deleting !== null}
          handleClose={closeDelete}
          handleSubmit={async () => {
            if (!deleting) return;
            setDeletingPending(true);
            setDeleteError("");
            try {
              await remove({ viewId: deleting.view._id, expectedUpdatedAt: deleting.view.updatedAt, deleted: true });
              closeDelete();
            } catch (error) {
              setDeleteError(mutationMessage(error));
            } finally {
              setDeletingPending(false);
            }
          }}
          isSubmitting={deletingPending}
          title="Delete view?"
          content={
            <>
              This view will leave active lists. You can restore it from Trash.
              {deleteError && (
                <p role="alert" className="mt-2 text-danger-primary">
                  {deleteError}
                </p>
              )}
            </>
          }
        />
      </div>
    </PreservedWorkspaceShell>
  );
}
