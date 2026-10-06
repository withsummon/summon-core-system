import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import { useQuery } from "convex/react";
import type { UsePaginatedQueryReturnType } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import { api } from "@summon/convex/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { Command } from "cmdk";
import {
  StickyNote,
  Plus,
  Briefcase,
  FolderPlus,
  CalendarDays,
  Layers,
  PenSquare,
  BarChart2,
  LayoutGrid,
  FileText,
} from "lucide-react";
import { ContrastIcon, DiceIcon } from "@plane/propel/icons";
import { generateWorkItemLink } from "@plane/utils";
import useDebounce from "@/hooks/use-debounce";
import { useTranslation } from "@plane/i18n";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { NativeProjectCreateContext, NativeTaskCreateContext } from "@/components/workspace/native-shell/session";
import { opportunitiesHref } from "@/components/summon/opportunities/opportunity-pipeline";
import { CommandSearchView } from "@/components/navigation/command-search-view";
import { PowerKModalFooter } from "@/components/power-k/ui/modal/footer";
import { PowerKModalCommandItem } from "@/components/power-k/ui/modal/command-item";
import { PowerKMenuBuilder } from "@/components/power-k/menus/builder";
import { KeySequenceHandler, isTypingInInput } from "@/components/power-k/core/shortcut-handler";
import { useExpandableSearch } from "@/hooks/use-expandable-search";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { NativeWorkspace } from "./session";
export function WorkspaceCommands({
  workspace,
  workspaces,
  onCreateSticky,
  onOpenStickies,
  commands,
}: {
  workspace: NativeWorkspace;
  workspaces: NativeWorkspace[];
  onCreateSticky: () => Promise<void>;
  onOpenStickies: () => void;
  commands?: (close: () => void) => ReactNode;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [choosingProject, setChoosingProject] = useState(false);
  const [isWorkspaceLevel, setWorkspaceLevel] = useState(false);
  const debouncedTerm = useDebounce(searchTerm, 500);
  const params = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const createProject = useContext(NativeProjectCreateContext);
  const createTask = useContext(NativeTaskCreateContext);
  const onSearchClose = useCallback(() => {
    setSearchTerm("");
    setChoosingProject(false);
  }, []);
  const search = useExpandableSearch({ onClose: onSearchClose });
  const { openPanel, inputRef, isOpen, handleClose } = search;
  const browse = useQuery(
    api.navigation.address.resolveTask,
    isOpen && params.workItem ? { workspaceSlug: workspace.slug, workItem: params.workItem } : "skip"
  );
  const currentProjectId = params.projectId ?? browse?.project._id;
  const scopeProjectId = isWorkspaceLevel ? undefined : currentProjectId;
  const workspaceCommands = useMemo(
    () =>
      [
        {
          label: t("power_k.creation_actions.create_work_item"),
          icon: Layers,
          keySequence: "ni",
          isDisabled: createTask === null,
          onSelect: () => {
            handleClose();
            createTask?.();
          },
        },
        {
          label: t("power_k.navigation_actions.nav_summon_tasks"),
          icon: Layers,
          onSelect: () => {
            handleClose();
            navigate(`/${workspace.slug}/summon/tasks/`);
          },
        },
        {
          label: t("power_k.navigation_actions.nav_workspace_analytics"),
          icon: BarChart2,
          keySequence: "ga",
          isDisabled: workspace.membershipRole === "guest",
          onSelect: () => {
            handleClose();
            navigate(`/${workspace.slug}/analytics/overview`);
          },
        },
        {
          label: t("power_k.navigation_actions.nav_workspace_drafts"),
          icon: PenSquare,
          keySequence: "gj",
          isDisabled: workspace.membershipRole === "guest",
          onSelect: () => {
            handleClose();
            navigate(`/${workspace.slug}/drafts/`);
          },
        },
        {
          label: t("power_k.creation_actions.create_project"),
          icon: FolderPlus,
          keySequence: "np",
          isDisabled: createProject === null,
          onSelect: () => {
            handleClose();
            createProject?.();
          },
        },
        {
          label: t("power_k.navigation_actions.open_project"),
          icon: Briefcase,
          keySequence: "op",
          onSelect: () => {
            setSearchTerm("");
            setChoosingProject(true);
            openPanel();
            inputRef.current?.focus();
          },
        },
        {
          label: t("power_k.navigation_actions.nav_projects_list"),
          icon: Briefcase,
          keySequence: "gp",
          onSelect: () => {
            handleClose();
            navigate(`/${workspace.slug}/projects/`);
          },
        },
        {
          label: t("power_k.creation_actions.create_summon_client"),
          icon: Briefcase,
          isDisabled: workspace.membershipRole === "guest",
          onSelect: () => {
            handleClose();
            navigate(`/${workspace.slug}/summon/clients/`);
          },
        },
        {
          label: t("power_k.navigation_actions.nav_summon_clients"),
          icon: Briefcase,
          onSelect: () => {
            handleClose();
            navigate(`/${workspace.slug}/summon/clients/`);
          },
        },
        {
          label: t("power_k.creation_actions.create_summon_opportunity"),
          icon: Briefcase,
          isDisabled: workspace.membershipRole === "guest",
          onSelect: () => {
            handleClose();
            navigate(opportunitiesHref(workspace.slug, { create: true }));
          },
        },
        {
          label: t("power_k.navigation_actions.nav_summon_opportunities"),
          icon: Briefcase,
          onSelect: () => {
            handleClose();
            navigate(`/${workspace.slug}/summon/opportunities/`);
          },
        },
        {
          label: t("power_k.creation_actions.create_summon_meeting"),
          icon: CalendarDays,
          isDisabled: workspace.membershipRole === "guest",
          onSelect: () => {
            handleClose();
            navigate(`/${workspace.slug}/summon/meetings/`);
          },
        },
        {
          label: t("power_k.navigation_actions.nav_summon_meetings"),
          icon: CalendarDays,
          onSelect: () => {
            handleClose();
            navigate(`/${workspace.slug}/summon/meetings/`);
          },
        },
      ] satisfies ComponentProps<typeof PowerKModalCommandItem>[],
    [t, createProject, createTask, handleClose, openPanel, inputRef, navigate, workspace.slug, workspace.membershipRole]
  );
  useEffect(() => {
    const sequences = new KeySequenceHandler((sequence, event) => {
      const command = workspaceCommands.find((item) => item.keySequence === sequence && !item.isDisabled);
      if (!command) return false;
      event.preventDefault();
      command.onSelect();
      return true;
    });
    const handle = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (isOpen) handleClose();
        else {
          openPanel();
          inputRef.current?.focus();
        }
      } else if (
        !event.defaultPrevented &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        !isTypingInInput(event.target) &&
        !document.querySelector('[role="dialog"]')
      ) {
        sequences.handleKeyDown(event);
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      sequences.destroy();
    };
  }, [openPanel, inputRef, isOpen, handleClose, workspaceCommands]);
  const create = async () => {
    search.handleClose();
    try {
      await onCreateSticky();
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Unable to create sticky",
        message: error instanceof Error ? error.message : "Try again.",
      });
    }
  };
  return (
    <CommandSearchView
      {...search}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      handleClear={() => {
        setSearchTerm("");
        search.inputRef.current?.focus();
      }}
      handleKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          search.handleClose();
        }
        if (event.key === "Enter") {
          event.preventDefault();
          search.containerRef.current?.querySelector<HTMLElement>('[cmdk-item][aria-selected="true"]')?.click();
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          search.containerRef.current
            ?.querySelector("[cmdk-list]")
            ?.dispatchEvent(new KeyboardEvent("keydown", { key: event.key, bubbles: true, cancelable: true }));
        }
      }}
      footer={
        <PowerKModalFooter
          isWorkspaceLevel={!currentProjectId || isWorkspaceLevel}
          projectId={currentProjectId}
          onWorkspaceLevelChange={setWorkspaceLevel}
        />
      }
    >
      {choosingProject ? (
        <ProjectPicker
          workspace={workspace}
          onSelect={(projectId) => {
            handleClose();
            navigate(`/${workspace.slug}/projects/${projectId}/issues/`);
          }}
        />
      ) : (
        <>
          {!searchTerm && <Command.Empty className="p-3 text-13 text-tertiary">No commands found.</Command.Empty>}
          {searchTerm && debouncedTerm !== searchTerm && (
            <p role="status" className="p-3 text-13 text-secondary">
              Searching…
            </p>
          )}
          {searchTerm &&
            debouncedTerm === searchTerm &&
            (params.workItem && !params.projectId && !isWorkspaceLevel && browse == null ? (
              <p role="status" className="p-3 text-13 text-secondary">
                {browse === undefined ? "Resolving project…" : "Work item unavailable."}
              </p>
            ) : (
              <EntitySearchResults
                key={`${workspace._id}:${scopeProjectId ?? "workspace"}:${debouncedTerm}`}
                workspace={workspace}
                workspaces={workspaces}
                projectId={scopeProjectId}
                term={debouncedTerm}
                onClose={search.handleClose}
              />
            ))}
          {workspaceCommands
            .filter((item) => !item.isDisabled)
            .map((item) => (
              <PowerKModalCommandItem key={item.keySequence ?? item.label} {...item} />
            ))}
          {commands?.(search.handleClose)}
          <Command.Item
            value="Create new sticky"
            onSelect={() => void create()}
            className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-13 data-[selected=true]:bg-layer-2"
          >
            <Plus className="size-4" />
            Create new sticky
          </Command.Item>
          <Command.Item
            value="Open all stickies"
            onSelect={() => {
              search.handleClose();
              onOpenStickies();
            }}
            className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-13 data-[selected=true]:bg-layer-2"
          >
            <StickyNote className="size-4" />
            Open all stickies
          </Command.Item>
        </>
      )}
    </CommandSearchView>
  );
}

function ProjectPicker({
  workspace,
  onSelect,
}: {
  workspace: NativeWorkspace;
  onSelect: (projectId: FunctionReturnType<typeof api.projects.network.get>["projectId"]) => void;
}) {
  const { status, results, loadMore } = usePaginatedQuery(
    api.projects.network.list,
    { workspaceId: workspace._id, archived: false },
    { initialNumItems: 50 }
  );
  useEffect(() => {
    if (status === "CanLoadMore") loadMore(50);
  }, [status, loadMore]);
  return status === "Exhausted" ? (
    <>
      <Command.Empty className="p-3 text-13 text-tertiary">No projects found.</Command.Empty>
      <PowerKMenuBuilder
        items={results.filter((project) => project.joined)}
        getKey={(project) => project.projectId}
        getValue={(project) => project.name}
        getLabel={(project) => project.name}
        getIconNode={(project) => <Logo logo={project.logo ?? undefined} size={14} />}
        onSelect={(project) => onSelect(project.projectId)}
        emptyText="No projects found"
      />
    </>
  ) : (
    <p role="status" className="p-3 text-13 text-secondary">
      Loading projects…
    </p>
  );
}

function EntitySearchResults({
  workspace,
  workspaces,
  projectId,
  term,
  onClose,
}: {
  workspace: NativeWorkspace;
  workspaces: NativeWorkspace[];
  projectId?: string;
  term: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const scope = { workspaceId: workspace._id, projectId, search: term };
  const projects = usePaginatedQuery(
    api.workspaces.index.searchEntities,
    { workspaceId: workspace._id, search: term, entity: "project" },
    { initialNumItems: 20 }
  );
  const tasks = usePaginatedQuery(
    api.workspaces.index.searchEntities,
    { ...scope, entity: "task" },
    { initialNumItems: 20 }
  );
  const cycles = usePaginatedQuery(
    api.workspaces.index.searchEntities,
    { ...scope, entity: "cycle" },
    { initialNumItems: 20 }
  );
  const modules = usePaginatedQuery(
    api.workspaces.index.searchEntities,
    { ...scope, entity: "module" },
    { initialNumItems: 20 }
  );
  const views = usePaginatedQuery(
    api.workspaces.index.searchEntities,
    { ...scope, entity: "view" },
    { initialNumItems: 20 }
  );
  const documents = usePaginatedQuery(
    api.workspaces.index.searchEntities,
    { ...scope, entity: "document" },
    { initialNumItems: 20 }
  );
  const matchedWorkspaces = workspaces
    .filter((row) => row.name.toLowerCase().includes(term.toLowerCase()))
    .toSorted((a, b) => b._creationTime - a._creationTime);
  const statuses = [projects.status, tasks.status, cycles.status, modules.status, views.status, documents.status];
  const loading = statuses.some((status) => status === "LoadingFirstPage" || status === "LoadingMore");
  const exhausted = statuses.every((status) => status === "Exhausted");
  const noEntityMatches =
    projects.results.length +
      tasks.results.length +
      cycles.results.length +
      modules.results.length +
      views.results.length +
      documents.results.length ===
    0;
  return (
    <>
      <p className="px-3 py-2 text-13 text-secondary">Search results in {projectId ? "this project" : "workspace"}:</p>
      {loading && (
        <p role="status" className="p-3 text-13 text-secondary">
          Searching…
        </p>
      )}
      {exhausted && noEntityMatches && !matchedWorkspaces.length && (
        <Command.Empty className="p-3 text-13 text-tertiary">No matching commands or entities.</Command.Empty>
      )}
      {matchedWorkspaces.length > 0 && (
        <Command.Group heading="Workspaces">
          {matchedWorkspaces.map((row) => (
            <PowerKModalCommandItem
              key={row._id}
              icon={LayoutGrid}
              value={`workspace-${term}-${row._id}-${row.name}`}
              label={row.name}
              onSelect={() => {
                onClose();
                navigate(`/${row.slug}/`);
              }}
            />
          ))}
        </Command.Group>
      )}
      <EntitySearchGroup entity="project" page={projects} workspace={workspace} term={term} onClose={onClose} />
      <EntitySearchGroup entity="task" page={tasks} workspace={workspace} term={term} onClose={onClose} />
      <EntitySearchGroup entity="cycle" page={cycles} workspace={workspace} term={term} onClose={onClose} />
      <EntitySearchGroup entity="module" page={modules} workspace={workspace} term={term} onClose={onClose} />
      <EntitySearchGroup entity="view" page={views} workspace={workspace} term={term} onClose={onClose} />
      <EntitySearchGroup entity="document" page={documents} workspace={workspace} term={term} onClose={onClose} />
    </>
  );
}

function EntitySearchGroup({
  entity,
  page,
  workspace,
  term,
  onClose,
}: {
  entity: FunctionArgs<typeof api.workspaces.index.searchEntities>["entity"];
  page: UsePaginatedQueryReturnType<typeof api.workspaces.index.searchEntities>;
  workspace: NativeWorkspace;
  term: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const headings = {
    project: "Projects",
    task: "Work items",
    cycle: "Cycles",
    module: "Modules",
    view: "Views",
    document: "Pages",
  } satisfies Record<FunctionArgs<typeof api.workspaces.index.searchEntities>["entity"], string>;
  const icons = {
    project: Briefcase,
    task: Layers,
    cycle: ContrastIcon,
    module: DiceIcon,
    view: Layers,
    document: FileText,
  };
  const rows = entity === "task" ? page.results.slice(0, 100) : page.results;
  const capped = entity === "task" && rows.length === 100;
  if (!rows.length && page.status === "Exhausted") return null;
  return (
    <Command.Group heading={headings[entity]}>
      {rows.map((row) => (
        <PowerKModalCommandItem
          key={row.id}
          icon={icons[entity]}
          value={`${row.entity}-${term}-${row.id}-${row.name}`}
          label={
            row.entity === "project" ? (
              row.name
            ) : (
              <span>
                <span className="text-11 text-tertiary">
                  {row.projectIdentifier}
                  {row.entity === "task" ? `-${row.sequence}` : ""}
                </span>{" "}
                {row.name}
              </span>
            )
          }
          onSelect={() => {
            onClose();
            switch (row.entity) {
              case "project":
                navigate(`/${workspace.slug}/projects/${row.id}/issues/`);
                break;
              case "task":
                navigate(
                  generateWorkItemLink({
                    workspaceSlug: workspace.slug,
                    projectId: row.projectId,
                    issueId: row.id,
                    projectIdentifier: row.projectIdentifier,
                    sequenceId: row.sequence,
                  })
                );
                break;
              case "cycle":
                navigate(`/${workspace.slug}/projects/${row.projectId}/cycles/${row.id}/`);
                break;
              case "module":
                navigate(`/${workspace.slug}/projects/${row.projectId}/modules/${row.id}/`);
                break;
              case "view":
                navigate(`/${workspace.slug}/projects/${row.projectId}/views/${row.id}/`);
                break;
              case "document":
                navigate(`/${workspace.slug}/projects/${row.projectId}/pages/${row.id}/`);
                break;
            }
          }}
        />
      ))}
      {page.status === "CanLoadMore" && !capped && (
        <PowerKModalCommandItem
          value={`continue-${term}-${entity}`}
          label={`Continue searching ${headings[entity].toLowerCase()}`}
          onSelect={() => page.loadMore(entity === "task" ? Math.min(20, 100 - rows.length) : 20)}
        />
      )}
      {capped && <p className="p-3 text-13 text-tertiary">Showing the first 100 matching work items.</p>}
    </Command.Group>
  );
}
