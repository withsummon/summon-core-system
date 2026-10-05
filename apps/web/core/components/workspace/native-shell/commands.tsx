import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import { useNavigate } from "react-router";
import { usePaginatedQuery } from "convex-helpers/react";
import { api } from "@summon/convex/api";
import type { FunctionReturnType } from "convex/server";
import { Command } from "cmdk";
import { StickyNote, Plus, Briefcase, FolderPlus, CalendarDays, Layers, PenSquare } from "lucide-react";
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
  onCreateSticky,
  onOpenStickies,
  commands,
}: {
  workspace: NativeWorkspace;
  onCreateSticky: () => Promise<void>;
  onOpenStickies: () => void;
  commands?: (close: () => void) => ReactNode;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [choosingProject, setChoosingProject] = useState(false);
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
      footer={<PowerKModalFooter isWorkspaceLevel={false} projectId={undefined} onWorkspaceLevelChange={() => {}} />}
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
          <Command.Empty className="p-3 text-13 text-tertiary">No commands found.</Command.Empty>
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
