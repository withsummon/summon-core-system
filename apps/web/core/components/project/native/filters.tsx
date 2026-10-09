import { ListFilter } from "lucide-react";
import { ChevronDownIcon } from "@plane/propel/icons";
import { useTranslation } from "@plane/i18n";
import type { TProjectDisplayFilters, TProjectFilters } from "@plane/types";
import { calculateTotalFilters, satisfiesDateFilter } from "@plane/utils";
import { orderBy, sortBy } from "lodash-es";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { FiltersDropdown } from "@/components/issues/issue-layouts/filters";
import { ProjectOrderByDropdown } from "../dropdowns/order-by";
import { ProjectFiltersSelectionView } from "../dropdowns/filters/root";
import { ProjectMemberFilterView, type ProjectMemberFilterOption } from "../dropdowns/filters/lead";

type Project = FunctionReturnType<typeof api.projects.network.get>;
type Membership = FunctionReturnType<typeof api.projects.directory.memberships>["page"][number];
export function selectDirectoryProjects(
  projects: readonly Project[],
  memberships: ReadonlyMap<Id<"projects">, readonly Membership[]>,
  search: string,
  filters: TProjectFilters,
  display: TProjectDisplayFilters
) {
  const query = search.toLowerCase();
  const matches = projects.filter(
    (project) =>
      (project.name.toLowerCase().includes(query) || project.identifier.toLowerCase().includes(query)) &&
      (!display.my_projects || project.joined) &&
      (!filters.access?.length || filters.access.includes(String(project.network))) &&
      (!filters.lead?.length || (project.lead !== null && filters.lead.includes(project.lead.userId))) &&
      (!filters.members?.length ||
        memberships.get(project.projectId)?.some((member) => filters.members?.includes(member.userId))) &&
      (!filters.created_at?.length ||
        filters.created_at.every((filter) => satisfiesDateFilter(new Date(project.createdAt), filter)))
  );
  switch (display.order_by) {
    case "sort_order":
      return sortBy(matches, (project) => project.personalOrder?.sortOrder);
    case "name":
      return sortBy(matches, (project) => project.name.toLowerCase());
    case "-name":
      return orderBy(matches, (project) => project.name.toLowerCase(), "desc");
    case "created_at":
      return sortBy(matches, (project) => project.createdAt);
    case "-created_at":
      return orderBy(matches, (project) => project.createdAt, "desc");
    case "members_length":
      return sortBy(matches, (project) => memberships.get(project.projectId)?.length ?? 0);
    case "-members_length":
      return orderBy(matches, (project) => memberships.get(project.projectId)?.length ?? 0, "desc");
    default:
      return matches;
  }
}

export function NativeProjectFilters({
  displayFilters,
  filters,
  onFiltersChange,
  onDisplayChange,
  leads,
  members,
  currentUserId,
  mobile = false,
}: {
  displayFilters: TProjectDisplayFilters;
  filters: TProjectFilters;
  onFiltersChange: (key: keyof TProjectFilters, value: string | string[]) => void;
  onDisplayChange: (value: Partial<TProjectDisplayFilters>) => void;
  leads: readonly ProjectMemberFilterOption[] | undefined;
  members: readonly ProjectMemberFilterOption[] | undefined;
  currentUserId: string;
  mobile?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className={mobile ? "flex w-full border-b border-subtle bg-surface-1 py-2 md:hidden" : "flex gap-3"}>
      <ProjectOrderByDropdown
        value={displayFilters.order_by}
        onChange={(order_by) => onDisplayChange({ order_by })}
        isMobile={mobile}
      />
      <div className={mobile ? "flex w-full justify-around border-l border-subtle" : undefined}>
        <FiltersDropdown
          icon={<ListFilter className="h-3 w-3" />}
          title={t("common.filters")}
          placement="bottom-end"
          isFiltersApplied={calculateTotalFilters(filters) !== 0}
          menuButton={
            mobile ? (
              <div className="flex items-center gap-2 text-13 text-secondary">
                <ListFilter className="h-3 w-3" />
                {t("common.filters")}
                <ChevronDownIcon className="h-3 w-3" strokeWidth={2} />
              </div>
            ) : null
          }
        >
          <ProjectFiltersSelectionView
            displayFilters={displayFilters}
            filters={filters}
            handleFiltersUpdate={onFiltersChange}
            handleDisplayFiltersUpdate={onDisplayChange}
            lead={(searchQuery) => (
              <ProjectMemberFilterView
                title="Lead"
                options={leads}
                currentUserId={currentUserId}
                appliedFilters={filters.lead ?? null}
                handleUpdate={(value) => onFiltersChange("lead", value)}
                searchQuery={searchQuery}
              />
            )}
            members={(searchQuery) => (
              <ProjectMemberFilterView
                title="Members"
                options={members}
                currentUserId={currentUserId}
                appliedFilters={filters.members ?? null}
                handleUpdate={(value) => onFiltersChange("members", value)}
                searchQuery={searchQuery}
              />
            )}
          />
        </FiltersDropdown>
      </div>
    </div>
  );
}
