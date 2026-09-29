import { useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import type { TProjectAppliedDisplayFilterKeys, TProjectFilters } from "@plane/types";
import { useTranslation } from "@plane/i18n";
import { calculateTotalFilters } from "@plane/utils";
import { Avatar, ContentWrapper } from "@plane/ui";
import { EmptyStateDetailed } from "@plane/propel/empty-state";
import { Button } from "@plane/propel/button";
import { ProjectsLoader } from "@/components/ui/loader/projects-loader";
import { AuthenticatedAssetImage } from "@/components/convex-core/assets/image";
import { ContentWrapper as PageContentWrapper } from "@/components/core/content-wrapper";
import { PageHead } from "@/components/core/page-title";
import { ProjectAppliedFiltersListView } from "../applied-filters/root";
import { AppliedMembersFiltersView } from "../applied-filters/members";
import type { ProjectMemberFilterOption } from "../dropdowns/filters/lead";
import { NativeProjectCard } from "../card";
import { NativeProjectHeader } from "../header";
import { NativeProjectFilters, selectDirectoryProjects } from "./filters";
import { NativeProjectOperations } from "./operations";
import type { ProjectDirectorySession } from "./route";

type Membership = FunctionReturnType<typeof api.projects.directory.memberships>["page"][number];
type Person = NonNullable<FunctionReturnType<typeof api.projects.network.get>["lead"]>;
export function NativeProjectDirectory({ session, archived }: { session: ProjectDirectorySession; archived: boolean }) {
  const { user, workspace, createProject, directory } = session;
  const { search, setSearch, filters, setFilters, display, setDisplay, selection, setSelection } = directory;
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const section = params.has("projectTrash") ? "trash" : archived ? "archived" : "active";
  const data = useProjectDirectoryData(workspace._id, section === "trash" || selection?.kind === "recover");
  const clearSelection = useCallback(() => setSelection(null), [setSelection]);
  const updateFilter = (key: keyof TProjectFilters, value: string | string[]) =>
    setFilters((current) => {
      let next = [...(current[key] ?? [])];
      if (Array.isArray(value)) {
        if (key === "created_at" && next.some((entry) => entry.includes("custom"))) next = [];
        for (const entry of value)
          next = next.includes(entry) ? next.filter((item) => item !== entry) : [...next, entry];
      } else if (next.includes(value)) next = next.filter((item) => item !== value);
      else next = key === "created_at" ? [value] : [...next, value];
      return { ...current, [key]: next };
    });
  const controls = {
    displayFilters: display,
    filters,
    onFiltersChange: updateFilter,
    onDisplayChange: (value: Partial<typeof display>) => setDisplay((current) => ({ ...current, ...value })),
    leads: data.complete ? data.leadOptions : undefined,
    members: data.complete ? data.memberOptions : undefined,
    currentUserId: user.id,
  };
  return (
    <>
      <PageHead
        title={`${workspace.name} - ${section === "trash" ? "Trash" : t("workspace_projects.label", { count: 2 })}`}
      />
      <NativeProjectHeader
        section={section}
        search={search}
        onSearch={setSearch}
        filters={<NativeProjectFilters {...controls} />}
        mobileFilters={<NativeProjectFilters {...controls} mobile />}
        create={createProject}
        onSectionChange={(next) =>
          navigate(
            next === "trash"
              ? `/${workspace.slug}/projects/?projectTrash=1`
              : next === "archived"
                ? `/${workspace.slug}/projects/archives/`
                : `/${workspace.slug}/projects/`
          )
        }
      />
      <PageContentWrapper>
        {section === "trash" ? (
          <NativeProjectTrash
            rows={data.trash}
            complete={data.trashComplete}
            onRestore={(project) => setSelection({ kind: "recover", project })}
          />
        ) : (
          <NativeDirectoryList session={session} data={data} archived={archived} />
        )}
      </PageContentWrapper>
      {selection && (
        <NativeProjectOperations
          selection={selection}
          projects={data.projects}
          projectsComplete={data.complete}
          deletedProjects={data.trash}
          deletedComplete={data.trashComplete}
          workspaceSlug={workspace.slug}
          onClose={clearSelection}
        />
      )}
    </>
  );
}

function useProjectDirectoryData(workspaceId: Id<"workspaces">, readTrash: boolean) {
  const active = usePaginatedQuery(
    api.projects.network.list,
    { workspaceId, archived: false },
    { initialNumItems: 50 }
  );
  const archive = usePaginatedQuery(
    api.projects.network.list,
    { workspaceId, archived: true },
    { initialNumItems: 50 }
  );
  const memberships = usePaginatedQuery(api.projects.directory.memberships, { workspaceId }, { initialNumItems: 50 });
  const trash = usePaginatedQuery(api.projects.lifecycle.list, readTrash ? { workspaceId } : "skip", {
    initialNumItems: 50,
  });
  const { status: activeStatus, loadMore: loadActive } = active;
  const { status: archiveStatus, loadMore: loadArchive } = archive;
  const { status: memberStatus, loadMore: loadMembers } = memberships;
  const { status: trashStatus, loadMore: loadTrash } = trash;
  useEffect(() => {
    if (activeStatus === "CanLoadMore") loadActive(50);
    if (archiveStatus === "CanLoadMore") loadArchive(50);
    if (memberStatus === "CanLoadMore") loadMembers(50);
    if (trashStatus === "CanLoadMore") loadTrash(50);
  }, [activeStatus, loadActive, archiveStatus, loadArchive, memberStatus, loadMembers, trashStatus, loadTrash]);
  const byProject = useMemo(() => {
    const groups = new Map<Id<"projects">, Membership[]>();
    for (const member of memberships.results) {
      const existing = groups.get(member.projectId);
      if (existing) existing.push(member);
      else groups.set(member.projectId, [member]);
    }
    return groups;
  }, [memberships.results]);
  const memberOptions = useMemo(
    () =>
      [...new Map(memberships.results.map((member) => [member.userId, member])).values()].map(directoryFilterOption),
    [memberships.results]
  );
  const projects = [...active.results, ...archive.results];
  const leadOptions = [
    ...new Map(
      projects
        .map((project) => project.lead)
        .filter((lead) => lead !== null)
        .map((lead) => [lead.userId, lead])
    ).values(),
  ].map(directoryFilterOption);
  return {
    active: active.results,
    archived: archive.results,
    projects,
    trash: trash.results,
    trashComplete: trashStatus === "Exhausted",
    byProject,
    memberOptions,
    leadOptions,
    complete: activeStatus === "Exhausted" && archiveStatus === "Exhausted" && memberStatus === "Exhausted",
  };
}

function directoryFilterOption(person: Person): ProjectMemberFilterOption {
  return {
    value: person.userId,
    label: person.name,
    icon: person.avatar ? (
      <AuthenticatedAssetImage
        asset={person.avatar}
        compactName={person.name}
        alt={person.name}
        className="size-6 rounded-full object-cover"
      />
    ) : (
      <Avatar name={person.name} showTooltip={false} size="md" />
    ),
  };
}

function NativeDirectoryList({
  session,
  data,
  archived,
}: {
  session: ProjectDirectorySession;
  data: ReturnType<typeof useProjectDirectoryData>;
  archived: boolean;
}) {
  const { workspace, directory } = session;
  const { search, filters, setFilters, display, setDisplay, setSelection } = directory;
  const cohort = archived ? data.archived : data.active;
  const visible = data.complete ? selectDirectoryProjects(cohort, data.byProject, search, filters, display) : cohort;
  const appliedDisplay: TProjectAppliedDisplayFilterKeys[] = display.my_projects ? ["my_projects"] : [];
  const hasFilters = calculateTotalFilters(filters) !== 0 || appliedDisplay.length > 0;
  const removeFilter = (key: keyof TProjectFilters, value: string | null) =>
    setFilters((current) => ({
      ...current,
      [key]: value === null ? [] : current[key]?.filter((entry) => entry !== value),
    }));
  return (
    <div className="flex h-full w-full flex-col">
      {data.complete && hasFilters && (
        <ProjectAppliedFiltersListView
          appliedFilters={filters}
          appliedDisplayFilters={appliedDisplay}
          handleClearAllFilters={() => {
            setFilters({});
            setDisplay((current) => ({ ...current, my_projects: false }));
          }}
          handleRemoveFilter={removeFilter}
          handleRemoveDisplayFilter={() => setDisplay((current) => ({ ...current, my_projects: false }))}
          alwaysAllowEditing
          filteredProjects={visible.length}
          totalProjects={data.projects.length}
          renderMembers={(key, values, editable) => (
            <AppliedMembersFiltersView
              values={values}
              editable={editable}
              options={key === "lead" ? data.leadOptions : data.memberOptions}
              handleRemove={(value) => removeFilter(key, value)}
            />
          )}
        />
      )}
      {!data.complete && <ProjectsLoader />}
      {data.complete && (
        <NativeDirectoryEmpty
          session={session}
          archived={archived}
          activeCount={data.active.length}
          visibleCount={visible.length}
          hasFilters={hasFilters}
        />
      )}
      <ContentWrapper>
        <div
          hidden={!data.complete}
          aria-busy={!data.complete}
          className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3"
        >
          {visible.map((project) => (
            <NativeProjectCard
              key={project.projectId}
              workspaceId={workspace._id}
              workspaceSlug={workspace.slug}
              project={project}
              ready={data.complete}
              members={data.complete ? (data.byProject.get(project.projectId) ?? []) : undefined}
              onJoin={(row) => setSelection({ kind: "join", project: row })}
              onRestore={(row) => setSelection({ kind: "restore", project: row })}
              onDelete={(row) => setSelection({ kind: "delete", project: row })}
            />
          ))}
        </div>
      </ContentWrapper>
    </div>
  );
}

function NativeDirectoryEmpty({
  session,
  archived,
  activeCount,
  visibleCount,
  hasFilters,
}: {
  session: ProjectDirectorySession;
  archived: boolean;
  activeCount: number;
  visibleCount: number;
  hasFilters: boolean;
}) {
  const { t } = useTranslation();
  if (!archived && activeCount === 0)
    return (
      <EmptyStateDetailed
        title={t("workspace_projects.empty_state.general.title")}
        description={t("workspace_projects.empty_state.general.description")}
        assetKey="project"
        assetClassName="size-40"
        actions={
          session.onCreateProject
            ? [
                {
                  label: t("workspace_projects.empty_state.general.primary_button.text"),
                  onClick: session.onCreateProject,
                  variant: "primary",
                },
              ]
            : []
        }
      />
    );
  if (visibleCount !== 0) return null;
  const noArchive = archived && !hasFilters && session.directory.search === "";
  return (
    <EmptyStateDetailed
      title={noArchive ? t("workspace_empty_state.projects_archived.title") : t("common_empty_state.search.title")}
      description={
        noArchive
          ? t("workspace_empty_state.projects_archived.description")
          : t("common_empty_state.search.description")
      }
      assetKey={noArchive ? "archived-work-item" : "search"}
      assetClassName="size-40"
    />
  );
}

type DeletedProject = FunctionReturnType<typeof api.projects.lifecycle.list>["page"][number];
function NativeProjectTrash({
  rows,
  complete,
  onRestore,
}: {
  rows: readonly DeletedProject[];
  complete: boolean;
  onRestore: (project: DeletedProject) => void;
}) {
  return (
    <PageContentWrapper>
      {!complete && <ProjectsLoader />}
      {complete && rows.length === 0 && (
        <EmptyStateDetailed
          title="No projects in Trash"
          description="Deleted projects you can restore will appear here."
          assetKey="project"
          assetClassName="size-40"
        />
      )}
      <ul hidden={!complete} aria-busy={!complete} className="divide-y divide-subtle-1">
        {rows.map((project) => (
          <li key={project.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0">
              <p className="text-12 text-secondary">{project.identifier}</p>
              <h3 className="text-16 font-medium break-words">{project.name}</h3>
              {project.archived && <span className="text-11 text-placeholder">Archived</span>}
            </div>
            <Button variant="secondary" onClick={() => onRestore(project)}>
              Restore
            </Button>
          </li>
        ))}
      </ul>
    </PageContentWrapper>
  );
}
