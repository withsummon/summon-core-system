import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useOutletContext } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { DEFAULT_GLOBAL_VIEWS_LIST } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { Dialog } from "@plane/propel/dialog";
import { Button } from "@plane/propel/button";
import { EditIcon, LinkIcon, LockIcon, NewTabIcon, SearchIcon, TrashIcon, ViewsIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { copyUrlToClipboard } from "@plane/utils";
import {
  AlertModalCore,
  Breadcrumbs,
  ContextMenu,
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
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";

import type { TContextMenuItem } from "@plane/ui";
import { AuthenticatedAssetImage } from "@/components/convex-core/assets/image";

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
                <SavedViewListItem
                  key={row.view._id}
                  row={row}
                  href={`/${session.workspace.slug}/workspace-views/${row.view._id}/`}
                  pending={deletingPending}
                  onEdit={() => setEditing(row.view._id)}
                  onRemove={() => setDeleting(row)}
                  onCopy={async () => {
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
                />
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
        <SavedViewEditor
          isOpen={creating || editing !== null}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        >
          {(onPendingChange) => (
            <>
              {creating && (
                <WorkspaceViewForm
                  workspaceId={session.workspace._id}
                  initial={null}
                  onPendingChange={onPendingChange}
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
                    canEdit={edited.canEdit}
                    onPendingChange={onPendingChange}
                    onDone={() => setEditing(null)}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <p role="status">Opening workspace view…</p>
                ))}
            </>
          )}
        </SavedViewEditor>
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

export function SavedViewEditor({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: (onPendingChange: (pending: boolean) => void) => ReactNode;
}) {
  const [pending, setPending] = useState(false);
  return (
    <ModalCore
      isOpen={isOpen}
      handleClose={() => {
        if (!pending) onClose();
      }}
      position={EModalPosition.TOP}
      width={EModalWidth.XXL}
    >
      <div className="max-h-[80vh] overflow-y-auto p-5">
        <Dialog.Title className="sr-only">View settings</Dialog.Title>
        <Dialog.Description className="sr-only">Save work item filters and view visibility.</Dialog.Description>
        {children(setPending)}
      </div>
    </ModalCore>
  );
}

export function SavedViewListItem({
  row,
  href,
  pending,
  onEdit,
  onRemove,
  onCopy,
  onFavorite,
}: {
  row: ViewRow | FunctionReturnType<typeof api.savedViews.index.list>["page"][number];
  href: string;
  pending: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onCopy: () => void;
  onFavorite?: () => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const items: TContextMenuItem[] = [
    { key: "edit", title: "Edit View", icon: EditIcon, action: onEdit, shouldRender: row.canEdit, disabled: pending },
    {
      key: "open",
      title: "Open in new tab",
      icon: NewTabIcon,
      action: () => window.open(href, "_blank"),
      disabled: pending,
    },
    { key: "copy", title: "Copy link", icon: LinkIcon, action: onCopy, disabled: pending },
    {
      key: "remove",
      title: row.canRestore ? "Restore View" : "Delete View",
      icon: TrashIcon,
      action: onRemove,
      shouldRender: row.canRemove || row.canRestore,
      disabled: pending,
    },
  ];
  return (
    <div
      ref={parentRef}
      className="group flex min-h-[52px] flex-wrap items-center gap-3 border-b border-subtle px-5 py-2 hover:bg-surface-2"
    >
      <Link to={href} className="flex min-w-0 flex-1 items-center gap-3">
        <Logo logo={row.logo ?? undefined} size={16} type="lucide" />
        <span className="min-w-0">
          <span className="block truncate text-13">{row.view.name}</span>
          {row.view.description && (
            <span className="block truncate text-11 text-secondary">{row.view.description}</span>
          )}
        </span>
      </Link>
      {row.view.access === "private" ? (
        <LockIcon className="size-4 text-tertiary" aria-label="Private view" />
      ) : (
        <span className="text-11 text-tertiary">Public</span>
      )}
      {"owner" in row && row.owner && (
        <span
          title={row.owner.fullName || row.owner.displayName || "View creator"}
          className="grid size-6 shrink-0 place-items-center overflow-hidden rounded-full bg-layer-2 text-11"
        >
          {row.owner.avatar ? (
            <AuthenticatedAssetImage
              asset={row.owner.avatar}
              alt="View creator"
              className="size-6 object-cover"
              compactName={row.owner.fullName || row.owner.displayName || "View creator"}
            />
          ) : (
            (row.owner.fullName || row.owner.displayName || "?").slice(0, 1)
          )}
        </span>
      )}
      {row.canFavorite && onFavorite && (
        <Button
          variant="ghost"
          size="sm"
          aria-label={`${row.isFavorite ? "Remove" : "Add"} ${row.view.name} ${row.isFavorite ? "from" : "to"} favorites`}
          aria-pressed={row.isFavorite}
          disabled={pending}
          onClick={onFavorite}
        >
          {row.isFavorite ? "★" : "☆"}
        </Button>
      )}
      <ContextMenu parentRef={parentRef} items={items} />
      <CustomMenu ellipsis placement="bottom-end" closeOnSelect buttonClassName="size-[26px]" disabled={pending}>
        {items
          .filter((item) => item.shouldRender !== false)
          .map((item) => (
            <CustomMenu.MenuItem key={item.key} onClick={item.action} disabled={item.disabled}>
              {item.icon && <item.icon className="size-3.5" />}
              {item.title}
            </CustomMenu.MenuItem>
          ))}
      </CustomMenu>
    </div>
  );
}
