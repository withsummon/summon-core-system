import { useState } from "react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { usePaginatedQuery } from "convex-helpers/react";
import { Link, useNavigate } from "react-router";
import { Button } from "@plane/propel/button";
import { Popover } from "@plane/propel/popover";
import { ComboboxPrimitive as Combobox } from "@plane/propel/combobox";
import {
  EditIcon,
  LinkIcon,
  NewTabIcon,
  TrashIcon,
  ViewsIcon,
  LockIcon,
  ChevronDownIcon,
  SearchIcon,
  CheckIcon,
} from "@plane/propel/icons";
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
  const navigate = useNavigate();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [search, setSearch] = useState("");
  const views = usePaginatedQuery(
    api.savedViews.index.list,
    switcherOpen ? { projectId: address.project._id, deleted: false, search } : "skip",
    { initialNumItems: 30 }
  );
  return (
    <Row className="z-[18] flex min-h-11 shrink-0 items-center border-b border-subtle bg-surface-1">
      <Header className="min-w-0 flex-wrap py-2 sm:flex-nowrap sm:py-0">
        <Header.LeftItem className="w-full max-w-full min-w-0 sm:w-auto sm:max-w-[80%]">
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
                <Popover
                  open={switcherOpen}
                  onOpenChange={(open) => {
                    setSwitcherOpen(open);
                    if (!open) setSearch("");
                  }}
                >
                  <Popover.Button
                    disabled={pending}
                    aria-label="Switch saved view"
                    className="flex min-w-0 items-center gap-2 rounded px-1.5 py-1 text-13 hover:bg-layer-1 disabled:opacity-50"
                  >
                    <Logo logo={detail.logo ?? undefined} size={16} type="lucide" />
                    <span className="truncate">{detail.view.name}</span>
                    {detail.view.access === "private" && (
                      <LockIcon className="size-3 shrink-0" aria-label="Private view" />
                    )}
                    <ChevronDownIcon className="size-3 shrink-0" />
                  </Popover.Button>
                  <Popover.Panel
                    side="bottom"
                    align="start"
                    sideOffset={4}
                    className="w-72 max-w-[calc(100vw-2rem)] rounded-md border border-subtle bg-surface-1 p-2 shadow-raised-200"
                  >
                    <Combobox.Root<Id<"savedViews">, Id<"savedViews">>
                      value={detail.view._id}
                      disabled={pending}
                      filter={null}
                      inputValue={search}
                      onInputValueChange={setSearch}
                      onValueChange={(id) => {
                        if (!pending && id !== null) {
                          setSwitcherOpen(false);
                          setSearch("");
                          if (id !== detail.view._id) navigate(`${path}${id}/`);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 rounded border border-subtle px-2">
                        <SearchIcon className="size-3.5 text-placeholder" />
                        <Combobox.Input
                          aria-label="Search saved views"
                          placeholder="Search views"
                          maxLength={255}
                          className="min-w-0 flex-1 bg-transparent py-2 text-13 outline-none"
                        />
                      </div>
                      <Combobox.List className="mt-2 max-h-64 space-y-1 overflow-auto">
                        {views.results.map((view) => (
                          <Combobox.Item
                            key={view.view._id}
                            value={view.view._id}
                            className="flex cursor-default items-center gap-2 rounded px-2 py-1.5 text-13 outline-none data-[highlighted]:bg-layer-transparent-hover"
                          >
                            <Logo logo={view.logo ?? undefined} size={16} type="lucide" />
                            <span className="min-w-0 flex-1 truncate">{view.view.name}</span>
                            {view.view.access === "private" && (
                              <LockIcon className="size-3 shrink-0" aria-label="Private view" />
                            )}
                            <Combobox.ItemIndicator>
                              <CheckIcon className="size-3" />
                            </Combobox.ItemIndicator>
                          </Combobox.Item>
                        ))}
                      </Combobox.List>
                    </Combobox.Root>
                    {views.status === "LoadingFirstPage" && (
                      <p role="status" className="p-2 text-13">
                        Loading views…
                      </p>
                    )}
                    {views.status === "Exhausted" && views.results.length === 0 && (
                      <p className="p-2 text-13 text-secondary">No matching views</p>
                    )}
                    {views.status === "CanLoadMore" && (
                      <Button size="sm" variant="secondary" disabled={pending} onClick={() => views.loadMore(30)}>
                        Load more views
                      </Button>
                    )}
                  </Popover.Panel>
                </Popover>
              }
            />
          </Breadcrumbs>
        </Header.LeftItem>
        <Header.RightItem className="w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
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
