import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { ViewsIcon } from "@plane/propel/icons";
import { Breadcrumbs, CustomMenu, Header } from "@plane/ui";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { FilterCreatedDate } from "@/components/common/filters/created-at";
import { ViewOrderByDropdown } from "@/components/views/filters/order-by";

type Criteria = Omit<FunctionArgs<typeof api.savedViews.index.list>, "projectId" | "paginationOpts">;
export function ProjectViewsHeader({
  project,
  path,
  criteria,
  onChange,
  dates,
  onDates,
  members,
  onCreate,
}: {
  project: FunctionReturnType<typeof api.projects.features.resolve>;
  path: string;
  criteria: Criteria;
  onChange: (criteria: Criteria) => void;
  dates: string[];
  onDates: (value: string | string[]) => void;
  members: FunctionReturnType<typeof api.projects.index.members>["members"];
  onCreate: () => void;
}) {
  return (
    <Header className="h-auto min-h-11 flex-wrap gap-y-2 py-2">
      <Header.LeftItem>
        <Breadcrumbs>
          <Breadcrumbs.Item
            component={<BreadcrumbLink label={project.name} href={path.replace(/views\/$/, "issues/")} />}
          />
          <Breadcrumbs.Item
            component={
              <BreadcrumbLink label="Views" href={path} icon={<ViewsIcon className="size-4 text-tertiary" />} isLast />
            }
            isLast
          />
        </Breadcrumbs>
      </Header.LeftItem>
      <Header.RightItem className="flex-wrap max-md:basis-full max-md:justify-start">
        <Input
          aria-label="Search views"
          type="search"
          maxLength={255}
          value={criteria.search ?? ""}
          onChange={(event) => onChange({ ...criteria, search: event.target.value })}
          placeholder="Search"
          inputSize="sm"
          className="w-36"
        />
        <ViewOrderByDropdown
          sortKey={criteria.orderBy ?? "updated_at"}
          sortBy={criteria.order ?? "desc"}
          onChange={(value) =>
            onChange({ ...criteria, orderBy: value.key ?? criteria.orderBy, order: value.order ?? criteria.order })
          }
        />
        <CustomMenu customButton={<span>Filters</span>} placement="bottom-end">
          <CustomMenu.MenuItem onClick={() => onChange({ ...criteria, favorites: !criteria.favorites })}>
            {criteria.favorites ? "✓ " : ""}Favorites
          </CustomMenu.MenuItem>
          <div className="p-2">
            <FilterCreatedDate appliedFilters={dates} handleUpdate={onDates} searchQuery="" />
          </div>
          <div className="border-t border-subtle p-2">
            <p className="mb-2 text-11 font-medium">Created by</p>
            {members.map((member) => (
              <CustomMenu.MenuItem
                key={member.userId}
                onClick={() =>
                  onChange({
                    ...criteria,
                    ownerIds: criteria.ownerIds?.includes(member.userId)
                      ? criteria.ownerIds.filter((id) => id !== member.userId)
                      : [...(criteria.ownerIds ?? []), member.userId],
                  })
                }
              >
                {criteria.ownerIds?.includes(member.userId) ? "✓ " : ""}
                {member.displayName || member.fullName}
              </CustomMenu.MenuItem>
            ))}
          </div>
        </CustomMenu>
        <Button variant="primary" size="lg" disabled={!project.features.views} onClick={onCreate}>
          Add view
        </Button>
      </Header.RightItem>
    </Header>
  );
}
