import { useContext, useRef, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router";
import { useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { MODULE_STATUS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { IconButton } from "@plane/propel/icon-button";
import { Input } from "@plane/propel/input";
import { ModuleIcon, ModuleStatusIcon } from "@plane/propel/icons";
import { Menu } from "@plane/propel/menu";
import { Popover } from "@plane/propel/popover";
import { ListFilter, Search, Info } from "lucide-react";
import { Breadcrumbs, Header, Row } from "@plane/ui";
import { EmptyStateDetailed } from "@plane/propel/empty-state";
import { renderFormattedDate } from "@plane/utils";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { ListItem } from "@/components/core/list";
import { PageHead } from "@/components/core/page-title";
import { ModuleLayoutIcon } from "@/components/modules/module-layout-icon";
import { memberLabel } from "@summon/convex/member-label";
import { usePlatformOS } from "@/hooks/use-platform-os";
import { FavoriteToggle } from "../favorites/toggle";
import { ModuleActions, ModuleCreateContext } from "./actions";
import { ModuleMemberChoices } from "./controls";
import { ModuleOverview } from "./overview";

type Address = FunctionReturnType<typeof api.navigation.address.resolveProjectId>;
type Catalogue = FunctionReturnType<typeof api.modules.index.catalogue>;
type Filters = FunctionArgs<typeof api.modules.index.directory>["filters"];
type Module = FunctionReturnType<typeof api.modules.index.directory>["page"][number];
type View = FunctionArgs<typeof api.modules.index.directory>["view"];
const orderLabels = { created_at: "Date created", name: "Name", target_date: "Due date" } satisfies Record<
  FunctionArgs<typeof api.modules.index.directory>["order"],
  string
>;
const viewLabels = { active: "Modules", archived: "Archived modules", trash: "Deleted modules" } satisfies Record<
  View,
  string
>;

export function ModuleDirectory({ view = "active" }: { view?: View }) {
  const address = useOutletContext<Address>();
  const catalogue = useQuery(api.modules.index.catalogue, { projectId: address.project._id });
  return catalogue ? (
    <DirectoryContent key={`${address.project._id}:${view}`} address={address} catalogue={catalogue} view={view} />
  ) : (
    <p role="status" className="p-6">
      Loading modules…
    </p>
  );
}

function DirectoryContent({ address, catalogue, view }: { address: Address; catalogue: Catalogue; view: View }) {
  const { t } = useTranslation();
  const { project, workspace } = address;
  const [filters, setFilters] = useState(catalogue.filters);
  const [order, setOrder] = useState<FunctionArgs<typeof api.modules.index.directory>["order"]>("created_at");
  const [layout, setLayout] = useState<"list" | "board">("list");
  const create = useContext(ModuleCreateContext);
  const modules = usePaginatedQuery(
    api.modules.index.directory,
    { projectId: project._id, filters, view, order },
    { initialNumItems: 30 }
  );
  const [params, setParams] = useSearchParams();
  const root = `/${workspace.slug}/projects/${project._id}/modules/`;
  const selected = params.get("peekModule");
  if (!create) throw new Error("Module creation requires its project route owner.");
  const canCreate = catalogue.canWrite && view === "active";
  const hasFilters = Object.values(filters).some((value) => (Array.isArray(value) ? value.length > 0 : Boolean(value)));
  const emptyTitles = { active: t("project_empty_state.modules.title"), archived: "No modules", trash: "No modules" };
  const emptyDescriptions = { active: t("project_empty_state.modules.description"), archived: "", trash: "" };
  return (
    <>
      <PageHead title={`${project.name} - Modules`} />
      <Row className="z-[18] flex min-h-11 shrink-0 items-center border-b border-subtle bg-surface-1">
        <Header>
          <Header.LeftItem className="min-w-0 flex-1">
            <Breadcrumbs>
              <Breadcrumbs.Item
                component={
                  <BreadcrumbLink label={project.name} href={`/${workspace.slug}/projects/${project._id}/issues/`} />
                }
              />
              <Breadcrumbs.Item
                component={
                  <BreadcrumbLink
                    label={viewLabels[view]}
                    href={root}
                    icon={<ModuleIcon className="size-4 text-tertiary" />}
                    isLast
                  />
                }
                isLast
              />
            </Breadcrumbs>
          </Header.LeftItem>
          <Header.RightItem className="shrink-0">
            <div className="hidden items-center gap-2 sm:flex">
              <Search className="size-3.5 text-tertiary" />
              <Input
                aria-label="Search modules"
                placeholder="Search"
                value={filters.search}
                onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                className="h-7 w-36 text-13"
              />
              <Menu label={orderLabels[order]}>
                {catalogue.orders.map((value) => (
                  <Menu.MenuItem key={value} onClick={() => setOrder(value)}>
                    {orderLabels[value]}
                  </Menu.MenuItem>
                ))}
              </Menu>
            </div>
            <DirectoryFilters
              projectId={project._id}
              filters={filters}
              catalogue={catalogue}
              order={order}
              onOrder={setOrder}
              onChange={setFilters}
            />
            <div className="hidden items-center gap-1 rounded-sm bg-layer-3 p-1 md:flex">
              <button
                type="button"
                aria-label="List layout"
                aria-pressed={layout === "list"}
                onClick={() => setLayout("list")}
                className={layout === "list" ? "rounded-sm bg-layer-transparent-active p-1" : "p-1"}
              >
                <ModuleLayoutIcon layoutType="list" />
              </button>
              <button
                type="button"
                aria-label="Board layout"
                aria-pressed={layout === "board"}
                onClick={() => setLayout("board")}
                className={layout === "board" ? "rounded-sm bg-layer-transparent-active p-1" : "p-1"}
              >
                <ModuleLayoutIcon layoutType="board" />
              </button>
            </div>
            {canCreate && (
              <Button size="lg" onClick={create}>
                {t("project_module.add_module")}
              </Button>
            )}
          </Header.RightItem>
        </Header>
      </Row>
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        <nav aria-label="Module views" className="flex gap-4 border-b border-subtle px-page-x py-2 text-13">
          <Link to={root} aria-current={view === "active" ? "page" : undefined}>
            Modules
          </Link>
          <Link
            to={`/${workspace.slug}/projects/${project._id}/archives/modules/`}
            aria-current={view === "archived" ? "page" : undefined}
          >
            Archived modules
          </Link>
          <Link to={`${root}?moduleView=trash`} aria-current={view === "trash" ? "page" : undefined}>
            Trash
          </Link>
        </nav>
        {hasFilters && (
          <div className="flex justify-end border-b border-subtle px-page-x py-2">
            <Button size="sm" variant="ghost" onClick={() => setFilters(catalogue.filters)}>
              Clear filters
            </Button>
          </div>
        )}
        {modules.status === "LoadingFirstPage" && (
          <p role="status" className="p-6">
            Loading modules…
          </p>
        )}
        {modules.status === "Exhausted" && modules.results.length === 0 && (
          <EmptyStateDetailed
            assetKey="module"
            title={hasFilters ? "No matching modules" : emptyTitles[view]}
            description={hasFilters ? "" : emptyDescriptions[view]}
            actions={
              canCreate
                ? [
                    {
                      label: t("project_empty_state.modules.cta_primary"),
                      onClick: create,
                      variant: "primary",
                    },
                  ]
                : []
            }
          />
        )}
        <div
          className={
            layout === "board"
              ? "grid auto-rows-max grid-cols-1 gap-6 px-page-x py-page-y lg:grid-cols-2 xl:grid-cols-3"
              : "flex flex-col"
          }
        >
          {modules.results.map((module) => (
            <DirectoryRow
              key={module._id}
              module={module}
              root={root}
              layout={layout}
              onPeek={() =>
                setParams((current) => {
                  const next = new URLSearchParams(current);
                  next.set("peekModule", module._id);
                  return next;
                })
              }
            />
          ))}
        </div>
        {modules.status === "CanLoadMore" && (
          <Button variant="secondary" className="m-4 self-start" onClick={() => modules.loadMore(30)}>
            Load more modules
          </Button>
        )}
        {modules.status === "LoadingMore" && (
          <p role="status" className="p-4">
            Loading more modules…
          </p>
        )}
      </div>
      {selected && (
        <ModuleOverview
          address={address}
          moduleId={selected}
          onClose={() =>
            setParams((current) => {
              const next = new URLSearchParams(current);
              next.delete("peekModule");
              return next;
            })
          }
        />
      )}
    </>
  );
}

function DirectoryFilters({
  projectId,
  filters,
  catalogue,
  order,
  onOrder,
  onChange,
}: {
  projectId: Address["project"]["_id"];
  filters: Filters;
  catalogue: Catalogue;
  order: FunctionArgs<typeof api.modules.index.directory>["order"];
  onOrder: (order: FunctionArgs<typeof api.modules.index.directory>["order"]) => void;
  onChange: (filters: Filters) => void;
}) {
  const { t } = useTranslation();
  return (
    <Popover>
      <Popover.Button
        className="flex h-7 items-center gap-1 rounded border border-strong px-2 text-11"
        aria-label="Module filters"
      >
        <ListFilter className="size-3" />
        Filters
      </Popover.Button>
      <Popover.Panel
        side="bottom"
        align="end"
        sideOffset={4}
        positionerClassName="z-[120]"
        className="w-72 space-y-3 rounded-md border border-subtle bg-surface-1 p-3 shadow-raised-200"
      >
        <Input
          aria-label="Search modules"
          placeholder="Search modules"
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
        />
        <Menu label={`Order by: ${orderLabels[order]}`}>
          {catalogue.orders.map((value) => (
            <Menu.MenuItem key={value} onClick={() => onOrder(value)}>
              {orderLabels[value]}
            </Menu.MenuItem>
          ))}
        </Menu>
        <label className="flex items-center gap-2 text-13">
          <input
            type="checkbox"
            checked={filters.favorites}
            onChange={(event) => onChange({ ...filters, favorites: event.target.checked })}
          />
          Favorites
        </label>
        <fieldset className="space-y-1">
          <legend className="text-13 font-medium">Status</legend>
          {MODULE_STATUS.map((status) => (
            <label key={status.value} className="flex items-center gap-2 text-13">
              <input
                type="checkbox"
                checked={filters.statuses.includes(status.value)}
                onChange={(event) =>
                  onChange({
                    ...filters,
                    statuses: event.target.checked
                      ? [...filters.statuses, status.value]
                      : filters.statuses.filter((value) => value !== status.value),
                  })
                }
              />
              <ModuleStatusIcon status={status.value} />
              {t(status.i18n_label)}
            </label>
          ))}
        </fieldset>
        <ModuleMemberChoices
          projectId={projectId}
          value={filters.leadIds}
          onChange={(leadIds) => onChange({ ...filters, leadIds })}
          label="Leads"
        />
        <ModuleMemberChoices
          projectId={projectId}
          value={filters.memberIds}
          onChange={(memberIds) => onChange({ ...filters, memberIds })}
          label="Members"
        />
        <div className="grid grid-cols-2 gap-2 text-11 text-secondary">
          <label htmlFor="modules-filter-start-after">
            Start after
            <Input
              id="modules-filter-start-after"
              type="date"
              value={filters.startAfter ?? ""}
              onChange={(event) => onChange({ ...filters, startAfter: event.target.value || null })}
            />
          </label>
          <label htmlFor="modules-filter-start-before">
            Start before
            <Input
              id="modules-filter-start-before"
              type="date"
              value={filters.startBefore ?? ""}
              onChange={(event) => onChange({ ...filters, startBefore: event.target.value || null })}
            />
          </label>
          <label htmlFor="modules-filter-target-after">
            Due after
            <Input
              id="modules-filter-target-after"
              type="date"
              value={filters.targetAfter ?? ""}
              onChange={(event) => onChange({ ...filters, targetAfter: event.target.value || null })}
            />
          </label>
          <label htmlFor="modules-filter-target-before">
            Due before
            <Input
              id="modules-filter-target-before"
              type="date"
              value={filters.targetBefore ?? ""}
              onChange={(event) => onChange({ ...filters, targetBefore: event.target.value || null })}
            />
          </label>
        </div>
        <Button size="sm" variant="ghost" onClick={() => onChange(catalogue.filters)}>
          Clear filters
        </Button>
      </Popover.Panel>
    </Popover>
  );
}

function DirectoryRow({
  module,
  root,
  layout,
  onPeek,
}: {
  module: Module;
  root: string;
  layout: "list" | "board";
  onPeek: () => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const { isMobile } = usePlatformOS();
  const href = root + module._id + "/";
  const details = (
    <div className="flex flex-wrap items-center gap-3 text-13 text-secondary">
      <span className="capitalize">{module.status.replace("-", " ")}</span>
      <span>
        {module.startDate ? renderFormattedDate(module.startDate) : "Start date"} →{" "}
        {module.targetDate ? renderFormattedDate(module.targetDate) : "Target date"}
      </span>
      {module.lead && <span>{memberLabel(module.lead)}</span>}
    </div>
  );
  if (layout === "board")
    return (
      <article ref={parentRef} className="space-y-4 rounded-lg border border-subtle bg-layer-transparent p-4">
        <div className="flex items-start justify-between gap-2">
          <Link to={href} className="min-w-0 text-16 font-medium break-words">
            {module.name}
          </Link>
          <ModuleActions module={module} href={href} />
        </div>
        {details}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <IconButton
            icon={Info}
            size="sm"
            variant="ghost"
            aria-label={`Overview of ${module.name}`}
            onClick={onPeek}
          />
          {!module.deleted && (
            <FavoriteToggle workspaceId={module.workspaceId} target={{ type: "module", id: module._id }} />
          )}
        </div>
      </article>
    );
  return (
    <ListItem
      title={module.name}
      itemLink={href}
      parentRef={parentRef}
      isMobile={isMobile}
      prependTitleElement={<ModuleStatusIcon status={module.status} className="size-5" />}
      appendTitleElement={
        <IconButton
          icon={Info}
          size="sm"
          variant="ghost"
          aria-label={`Overview of ${module.name}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onPeek();
          }}
        />
      }
      actionableItems={
        <>
          {details}
          <ModuleActions module={module} href={href} />
        </>
      }
    />
  );
}
