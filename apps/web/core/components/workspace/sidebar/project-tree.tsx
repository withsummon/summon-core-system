/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import {
  ChartBarHorizontalIcon,
  CheckSquareIcon,
  HouseIcon,
  PushPinIcon,
  SquaresFourIcon,
} from "@phosphor-icons/react";
import { useLocalStorage } from "@plane/hooks";
import { Collapsible } from "@plane/propel/collapsible";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { ChevronRightIcon, SelectableIcon } from "@plane/propel/icons";
import type { TSelectableIcon } from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";
import { EIssueLayoutTypes, EIssuesStoreType } from "@plane/types";
import { CustomMenu } from "@plane/ui";
import { cn } from "@plane/utils";
// components
import { SidebarNavItem } from "@/components/sidebar/sidebar-navigation";
// hooks
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { useFavorite } from "@/hooks/store/use-favorite";
import { useIssues } from "@/hooks/store/use-issues";
import { useProject } from "@/hooks/store/use-project";
// local imports
import { useMoveJoinedProject, useProjectItemDragAndDrop } from "./use-project-item-drag-and-drop";

/** Most projects a user can pin under Projects. */
const MAX_PINNED = 3;
const OPEN_PROJECTS_KEY = "summon_sidebar_open_projects";
const NO_OPEN_PROJECTS: Record<string, boolean> = {};

type TProjectTab = { key: string; label: string; icon: TSelectableIcon; href: string; isActive: boolean };

/** The user's pinned projects, the project favorites the server keeps, in the user's project order. */
const useFavoriteProjectIds = () => {
  const { joinedProjectIds } = useProject();
  const { entityMap } = useFavorite();
  return joinedProjectIds.filter((id) => !!entityMap[id]);
};

/** A pinned project's tabs. Tasks and Timeline share the work items page and each requests its layout. */
const useProjectTabs = (workspaceSlug: string, projectId: string): TProjectTab[] => {
  const pathname = usePathname();
  const layoutParam = useSearchParams().get("layout");
  const { getProjectById } = useProject();
  const { issuesFilter } = useIssues(EIssuesStoreType.PROJECT);

  const homeHref = `/${workspaceSlug}/summon/projects/${projectId}`;
  const issuesHref = `/${workspaceSlug}/projects/${projectId}/issues`;
  const viewsHref = `/${workspaceSlug}/projects/${projectId}/views`;
  const isUnder = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  // The saved layout tells Tasks and Timeline apart, or the `?layout=` a just-clicked tab carries until it's saved.
  const savedLayout = issuesFilter.getIssueFilters(projectId)?.displayFilters?.layout;
  const isTimeline = ((isUnder(issuesHref) && layoutParam) || savedLayout) === EIssueLayoutTypes.GANTT;

  const tabs: TProjectTab[] = [
    { key: "home", label: "Home", icon: HouseIcon, href: homeHref, isActive: isUnder(homeHref) },
    {
      key: "tasks",
      label: "Tasks",
      icon: CheckSquareIcon,
      href: `${issuesHref}?layout=${EIssueLayoutTypes.LIST}`,
      isActive: isUnder(issuesHref) && !isTimeline,
    },
    {
      key: "timeline",
      label: "Timeline",
      icon: ChartBarHorizontalIcon,
      href: `${issuesHref}?layout=${EIssueLayoutTypes.GANTT}`,
      isActive: isUnder(issuesHref) && isTimeline,
    },
  ];
  if (getProjectById(projectId)?.issue_views_view)
    tabs.push({ key: "views", label: "Views", icon: SquaresFourIcon, href: viewsHref, isActive: isUnder(viewsHref) });
  return tabs;
};

/** Whether the project tree visibly marks the current page, so the Projects item needn't. */
export const useProjectTreeMarksRoute = (workspaceSlug: string) => {
  const { projectId: routeProjectId } = useParams();
  const projectId = routeProjectId?.toString() ?? "";
  const isPinned = useFavoriteProjectIds().slice(0, MAX_PINNED).includes(projectId);
  const { storedValue: openProjects } = useLocalStorage(OPEN_PROJECTS_KEY, NO_OPEN_PROJECTS);
  const tabs = useProjectTabs(workspaceSlug, projectId);
  return isPinned && !!openProjects?.[projectId] && tabs.some((tab) => tab.isActive);
};

/**
 * Pinned projects under the Projects nav item, each opening to Home, Tasks, Timeline and Views. Nothing shows
 * until the user pins a project. Rows keep the user's project order, which dragging a row changes; which rows
 * are open persists in this browser.
 */
export const SidebarProjectTree = observer(function SidebarProjectTree({ workspaceSlug }: { workspaceSlug: string }) {
  const pinnedIds = useFavoriteProjectIds().slice(0, MAX_PINNED);
  const moveProject = useMoveJoinedProject(workspaceSlug);
  const { storedValue: openProjects, setValue: setOpenProjects } = useLocalStorage(OPEN_PROJECTS_KEY, NO_OPEN_PROJECTS);

  if (!pinnedIds.length) return null;
  return (
    <ul className="ml-[15px] flex flex-col gap-0.5 border-l border-subtle pl-2">
      {pinnedIds.map((projectId, index) => (
        <SidebarProjectTreeItem
          key={projectId}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          isOpen={!!openProjects?.[projectId]}
          onToggle={(open) => setOpenProjects({ ...openProjects, [projectId]: open })}
          isLastChild={index === pinnedIds.length - 1}
          onDrop={moveProject}
        />
      ))}
    </ul>
  );
});

/** Pin button on the Projects nav item: picks which projects the tree shows. */
export const SidebarProjectPinMenu = observer(function SidebarProjectPinMenu(props: {
  workspaceSlug: string;
  className?: string;
}) {
  const { workspaceSlug, className } = props;
  const { joinedProjectIds, getPartialProjectById, addProjectToFavorites, removeProjectFromFavorites } = useProject();
  const favoriteIds = useFavoriteProjectIds();
  const isFull = favoriteIds.length >= MAX_PINNED;

  if (!joinedProjectIds.length) return null;
  return (
    <CustomMenu
      className={className}
      ariaLabel="Pin projects"
      customButton={
        <Tooltip tooltipContent="Pin projects">
          <span className="grid size-5 place-items-center rounded-sm text-tertiary hover:bg-layer-1-hover hover:text-primary">
            <PushPinIcon className="size-3.5" />
          </span>
        </Tooltip>
      }
      placement="right-start"
      maxHeight="lg"
      closeOnSelect={false}
    >
      <p className="px-2 py-1 text-11 text-tertiary">
        {isFull ? `Pinned ${MAX_PINNED} of ${MAX_PINNED}` : `Pin up to ${MAX_PINNED} projects`}
      </p>
      {joinedProjectIds.map((projectId) => {
        const project = getPartialProjectById(projectId);
        if (!project) return null;
        const isPinned = favoriteIds.includes(projectId);
        return (
          <CustomMenu.MenuItem
            key={projectId}
            disabled={!isPinned && isFull}
            onClick={() =>
              void (isPinned
                ? removeProjectFromFavorites(workspaceSlug, projectId)
                : addProjectToFavorites(workspaceSlug, projectId))
            }
          >
            <span className="flex w-full items-center gap-2">
              <Logo logo={project.logo_props} size={14} />
              <span className="flex-1 truncate">{project.name}</span>
              <PushPinIcon
                aria-label={isPinned ? "Pinned" : undefined}
                weight={isPinned ? "fill" : "regular"}
                className={cn("size-3.5 shrink-0", isPinned ? "text-accent-primary" : "text-placeholder")}
              />
            </span>
          </CustomMenu.MenuItem>
        );
      })}
    </CustomMenu>
  );
});

type TItemProps = {
  workspaceSlug: string;
  projectId: string;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  isLastChild: boolean;
  onDrop: (sourceId: string | undefined, destinationId: string | undefined, shouldDropAtEnd: boolean) => void;
};

const SidebarProjectTreeItem = observer(function SidebarProjectTreeItem(props: TItemProps) {
  const { workspaceSlug, projectId, isOpen, onToggle, isLastChild, onDrop } = props;
  const { getPartialProjectById, removeProjectFromFavorites } = useProject();
  const tabs = useProjectTabs(workspaceSlug, projectId);
  const { toggleSidebar } = useAppTheme();
  const project = getPartialProjectById(projectId);
  const { projectRef, isDragging, instruction } = useProjectItemDragAndDrop({
    projectId,
    project,
    isLastChild,
    projectListType: "JOINED",
    handleOnProjectDrop: onDrop,
  });
  if (!project) return null;

  const unpinLabel = `Unpin ${project.name}`;

  return (
    <li>
      <Collapsible.CollapsibleRoot isOpen={isOpen} onToggle={() => onToggle(!isOpen)}>
        <div ref={projectRef} className={cn("group/project relative rounded-md", isDragging && "opacity-50")}>
          {instruction && (
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-x-0 h-0.5 rounded-full bg-accent-primary",
                instruction === "DRAG_BELOW" ? "-bottom-px" : "-top-px"
              )}
            />
          )}
          <Collapsible.CollapsibleTrigger className="w-full rounded-md text-left">
            <SidebarNavItem>
              <span className="flex min-w-0 items-center gap-1.5 py-px pr-5">
                <span className="grid size-4 shrink-0 place-items-center">
                  <Logo logo={project.logo_props} size={14} />
                </span>
                <span className="truncate text-13 leading-5">{project.name}</span>
              </span>
              <ChevronRightIcon
                aria-hidden="true"
                className={cn("size-3.5 shrink-0 transition-transform duration-150", isOpen && "rotate-90")}
              />
            </SidebarNavItem>
          </Collapsible.CollapsibleTrigger>
          <Tooltip tooltipContent={unpinLabel}>
            <button
              type="button"
              aria-label={unpinLabel}
              onClick={() => void removeProjectFromFavorites(workspaceSlug, projectId)}
              className="absolute top-1/2 right-6 grid size-5 -translate-y-1/2 place-items-center rounded-sm text-tertiary transition-opacity hover:bg-layer-1-hover hover:text-primary focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-accent-strong pointer-fine:opacity-0 pointer-fine:group-hover/project:opacity-100"
            >
              <PushPinIcon weight="fill" className="size-3.5" />
            </button>
          </Tooltip>
        </div>
        <Collapsible.CollapsibleContent>
          <ul className="ml-[15px] flex flex-col gap-0.5 border-l border-subtle py-0.5 pl-2">
            {tabs.map((tab) => (
              <li key={tab.key}>
                <Link
                  href={tab.href}
                  aria-current={tab.isActive ? "page" : undefined}
                  onClick={() => window.innerWidth < 768 && toggleSidebar()}
                >
                  <SidebarNavItem isActive={tab.isActive}>
                    <span className="flex items-center gap-1.5 py-px">
                      <SelectableIcon icon={tab.icon} />
                      <span className="text-13 leading-5">{tab.label}</span>
                    </span>
                  </SidebarNavItem>
                </Link>
              </li>
            ))}
          </ul>
        </Collapsible.CollapsibleContent>
      </Collapsible.CollapsibleRoot>
    </li>
  );
});
