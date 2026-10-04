import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { Link } from "react-router";
import { Button } from "@plane/propel/button";
import { EditIcon, LinkIcon, NewTabIcon, TrashIcon, ViewsIcon, LockIcon } from "@plane/propel/icons";
import { Breadcrumbs, CustomMenu, Header, Row } from "@plane/ui";
import { Logo } from "@plane/propel/emoji-icon-picker";

export function ProjectViewIssuesHeader({
  address,
  detail,
  pending,
  onEdit,
  onFavorite,
  onLifecycle,
  onCopy,
  onCreateTask,
}: {
  address: FunctionReturnType<typeof api.navigation.address.resolveProjectId>;
  detail: FunctionReturnType<typeof api.savedViews.index.resolve>;
  pending: boolean;
  onEdit: () => void;
  onFavorite: () => void;
  onLifecycle: () => void;
  onCopy: () => void;
  onCreateTask: (() => void) | undefined;
}) {
  const path = `/${address.workspace.slug}/projects/${address.project._id}/views/`;
  return (
    <Row className="z-[18] flex min-h-11 shrink-0 items-center border-b border-subtle bg-surface-1">
      <Header>
        <Header.LeftItem>
          <Breadcrumbs>
            <Breadcrumbs.Item
              component={
                <Link
                  to={`/${address.workspace.slug}/projects/${address.project._id}/issues/`}
                  className="truncate text-13"
                >
                  {address.project.name}
                </Link>
              }
            />
            <Breadcrumbs.Item
              component={
                <Link to={path} className="flex items-center gap-2 text-13">
                  <ViewsIcon className="size-4" />
                  Views
                </Link>
              }
            />
            <Breadcrumbs.Item
              isLast
              component={
                <span className="flex min-w-0 items-center gap-2 text-13">
                  <Logo logo={detail.logo ?? undefined} size={16} type="lucide" />
                  <span className="truncate">{detail.view.name}</span>
                  {detail.view.access === "private" && (
                    <LockIcon className="size-3 shrink-0" aria-label="Private view" />
                  )}
                </span>
              }
            />
          </Breadcrumbs>
        </Header.LeftItem>
        <Header.RightItem className="flex-wrap items-center gap-2">
          {detail.canFavorite && (
            <Button variant="ghost" size="sm" disabled={pending} aria-pressed={detail.isFavorite} onClick={onFavorite}>
              {detail.isFavorite ? "Unfavorite" : "Favorite"}
            </Button>
          )}
          {onCreateTask && (
            <Button size="sm" disabled={pending} onClick={onCreateTask}>
              Add work item
            </Button>
          )}
          <CustomMenu ellipsis placement="bottom-end" closeOnSelect disabled={pending} aria-label="View actions">
            {detail.canEdit && (
              <CustomMenu.MenuItem onClick={onEdit}>
                <EditIcon className="size-3.5" />
                Edit view
              </CustomMenu.MenuItem>
            )}
            <CustomMenu.MenuItem
              onClick={() => window.open(`${path}${detail.view._id}/`, "_blank", "noopener,noreferrer")}
            >
              <NewTabIcon className="size-3.5" />
              Open in new tab
            </CustomMenu.MenuItem>
            <CustomMenu.MenuItem onClick={onCopy}>
              <LinkIcon className="size-3.5" />
              Copy link
            </CustomMenu.MenuItem>
            {(detail.canRemove || detail.canRestore) && (
              <CustomMenu.MenuItem onClick={onLifecycle}>
                <TrashIcon className="size-3.5" />
                {detail.canRestore ? "Restore view" : "Delete view"}
              </CustomMenu.MenuItem>
            )}
          </CustomMenu>
        </Header.RightItem>
      </Header>
    </Row>
  );
}
