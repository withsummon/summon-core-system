/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { MutableRefObject } from "react";
import { useCallback, useEffect, useState } from "react";
import { observer } from "mobx-react";
import type { useRouter } from "next/navigation";
import scrollIntoView from "smooth-scroll-into-view-if-needed";
import { CollapsiblePrimitive } from "@plane/propel/collapsible";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useOutsideClickDetector } from "@plane/hooks";
import { useTranslation } from "@plane/i18n";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { ChevronRightIcon } from "@plane/propel/icons";
import { IconButton } from "@plane/propel/icon-button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Tooltip } from "@plane/propel/tooltip";
import { DropIndicator, DragHandle, ControlLink } from "@plane/ui";
import type { TPartialProject, TProjectNavigationMode } from "@plane/types";
import { cn, copyUrlToClipboard } from "@plane/utils";
// components
import { DEFAULT_TAB_KEY, getTabUrl } from "@/components/navigation/tab-navigation-utils";
import { useTabPreferences } from "@/components/navigation/use-tab-preferences";
import { LeaveProjectModal } from "@/components/project/leave-project-modal";
import { PublishProjectModal } from "@/components/project/publish-project/modal";
// hooks
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { usePlatformOS } from "@/hooks/use-platform-os";
// local imports
import { HIGHLIGHT_CLASS } from "../../issues/issue-layouts/utils";
import { ProjectNavigation } from "./project-navigation";
import { ProjectQuickActionsMenu } from "./project-quick-actions-menu";
import { useMoveJoinedProject, useProjectItemDragAndDrop } from "./use-project-item-drag-and-drop";
import { useNavigationItems } from "@/components/navigation/use-navigation-items";

// Route state (workspaceSlug, isActive, router) comes from the list, so a navigation
// re-renders only the rows whose active state flips instead of every row.
type Props = {
  projectId: string;
  workspaceSlug: string;
  isActive: boolean;
  navigationMode: TProjectNavigationMode;
  router: ReturnType<typeof useRouter>;
  projectListType: "JOINED" | "FAVORITES";
  disableDrag?: boolean;
  disableDrop?: boolean;
  isLastChild: boolean;
  renderInExtendedSidebar?: boolean;
};

type ProjectDragHandleProps = {
  handleRef: MutableRefObject<HTMLDivElement | null>;
  isMobile: boolean;
  isDragging: boolean;
  isJoined: boolean;
  isForcedVisible: boolean;
};

function ProjectDragHandle({ handleRef, isMobile, isDragging, isJoined, isForcedVisible }: ProjectDragHandleProps) {
  const { t } = useTranslation();
  return (
    <Tooltip
      isMobile={isMobile}
      tooltipContent={isJoined ? t("drag_to_rearrange") : t("join_the_project_to_rearrange")}
      position="top-end"
      disabled={isDragging}
    >
      <div
        className={cn(
          "absolute top-1/2 -left-3 hidden -translate-y-1/2 cursor-grab items-center justify-center rounded-sm text-placeholder group-hover/project-item:flex",
          {
            "cursor-not-allowed opacity-60": !isJoined,
            "cursor-grabbing": isDragging,
            flex: isForcedVisible,
          }
        )}
        ref={handleRef}
      >
        <DragHandle className="bg-transparent" />
      </div>
    </Tooltip>
  );
}

/**
 * True from the first time `isOpen` is true. The row's modals read router params, so they mount on first open
 * and then stay (keeping the close animation) rather than re-rendering in every closed row on each navigation.
 */
function useHasOpened(isOpen: boolean) {
  const [hasOpened, setHasOpened] = useState(false);
  if (isOpen && !hasOpened) setHasOpened(true);
  return hasOpened;
}

/** URL of the project's preferred default tab, falling back when that tab isn't available. */
function useDefaultTabUrl(
  workspaceSlug: string,
  projectId: string,
  project: TPartialProject | undefined,
  allowPermissions: ReturnType<typeof useUserPermissions>["allowPermissions"]
) {
  const navigationItems = useNavigationItems({ workspaceSlug, projectId, project, allowPermissions });
  const { tabPreferences } = useTabPreferences(workspaceSlug, projectId);
  const defaultTabKey = tabPreferences.defaultTab;
  const tabKey = navigationItems.some((item) => item.key === defaultTabKey) ? defaultTabKey : DEFAULT_TAB_KEY;
  return project ? getTabUrl(workspaceSlug, project.id, tabKey) : "";
}

/** Opens the active project's navigation and scrolls it into view. */
function useOpenAndScrollToActiveProject(
  projectRef: MutableRefObject<HTMLDivElement | null>,
  isActive: boolean,
  setIsProjectListOpen: (value: boolean) => void
) {
  useEffect(() => {
    if (!isActive) return;
    setIsProjectListOpen(true);
    if (!projectRef.current) return;
    // Scroll to active project
    const timeoutId = setTimeout(() => {
      if (projectRef.current) {
        scrollIntoView(projectRef.current, {
          behavior: "smooth",
          block: "center",
          scrollMode: "if-needed",
        });
      }
    }, 200);
    return () => clearTimeout(timeoutId);
  }, [isActive, projectRef, setIsProjectListOpen]);
}

export const SidebarProjectsListItem = observer(function SidebarProjectsListItem(props: Props) {
  const {
    projectId,
    workspaceSlug,
    isActive,
    navigationMode,
    router,
    disableDrag,
    disableDrop,
    isLastChild,
    projectListType,
    renderInExtendedSidebar = false,
  } = props;
  // store hooks
  const { t } = useTranslation();
  const { getPartialProjectById } = useProject();
  const { isMobile } = usePlatformOS();
  const { allowPermissions } = useUserPermissions();
  const { getIsProjectListOpen, toggleProjectListOpen } = useCommandPalette();
  const { isExtendedProjectSidebarOpened, toggleExtendedProjectSidebar, toggleAnySidebarDropdown } = useAppTheme();

  // states
  const [leaveProjectModalOpen, setLeaveProjectModal] = useState(false);
  const [publishModalOpen, setPublishModal] = useState(false);
  const hasOpenedModal = useHasOpened(publishModalOpen || leaveProjectModalOpen);
  const [isMenuActive, setIsMenuActive] = useState(false);
  const isProjectListOpen = getIsProjectListOpen(projectId);
  // derived values
  const project = getPartialProjectById(projectId);

  const moveProject = useMoveJoinedProject(workspaceSlug);
  // drag and drop
  const { projectRef, dragHandleRef, isDragging, instruction } = useProjectItemDragAndDrop({
    projectId,
    project,
    disableDrag,
    disableDrop,
    isLastChild,
    projectListType,
    handleOnProjectDrop: moveProject,
  });

  const defaultTabUrl = useDefaultTabUrl(workspaceSlug, projectId, project, allowPermissions);

  // toggle project list open
  const setIsProjectListOpen = useCallback(
    (value: boolean) => toggleProjectListOpen(projectId, value),
    [projectId, toggleProjectListOpen]
  );
  // auth
  const isAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT, workspaceSlug, project?.id);
  const isAuthorized = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug,
    project?.id
  );

  const handleCopyText = () => {
    copyUrlToClipboard(`${workspaceSlug}/projects/${projectId}/issues`).then(() =>
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("link_copied"),
        message: t("project_link_copied_to_clipboard"),
      })
    );
  };

  const handleLeaveProject = () => {
    setLeaveProjectModal(true);
  };

  useEffect(() => {
    if (isMenuActive) toggleAnySidebarDropdown(true);
    else toggleAnySidebarDropdown(false);
  }, [isMenuActive, toggleAnySidebarDropdown]);

  useOutsideClickDetector(projectRef, () => projectRef?.current?.classList?.remove(HIGHLIGHT_CLASS));

  useOpenAndScrollToActiveProject(projectRef, isActive, setIsProjectListOpen);

  if (!project) return null;

  const isAccordionMode = navigationMode === "ACCORDION";

  const handleItemClick = () => {
    if (isAccordionMode) {
      setIsProjectListOpen(!isProjectListOpen);
    } else {
      router.push(defaultTabUrl);
    }
    // close the extended sidebar if it is open
    if (isExtendedProjectSidebarOpened && !isAccordionMode) {
      toggleExtendedProjectSidebar(false);
    }
  };

  const shouldHighlightProject = isActive && !isAccordionMode;

  return (
    <>
      {hasOpenedModal && (
        <>
          <PublishProjectModal isOpen={publishModalOpen} projectId={projectId} onClose={() => setPublishModal(false)} />
          <LeaveProjectModal
            project={project}
            isOpen={leaveProjectModalOpen}
            onClose={() => setLeaveProjectModal(false)}
          />
        </>
      )}
      <CollapsiblePrimitive.Root key={String(isActive)} open={isProjectListOpen} onOpenChange={setIsProjectListOpen}>
        <div
          id={`sidebar-${projectId}-${projectListType}`}
          className={cn("relative", {
            "bg-layer-1 opacity-60": isDragging,
          })}
          ref={projectRef}
        >
          <DropIndicator classNames="absolute top-0" isVisible={instruction === "DRAG_OVER"} />
          <div
            className={cn(
              "group/project-item relative flex w-full items-center rounded-md px-2 py-1.5 text-primary hover:bg-layer-transparent-hover",
              {
                "bg-surface-2": isMenuActive,
                "bg-layer-transparent-active": shouldHighlightProject,
              }
            )}
            id={`${project?.id}`}
          >
            {!disableDrag && (
              <ProjectDragHandle
                handleRef={dragHandleRef}
                isMobile={isMobile}
                isDragging={isDragging}
                isJoined={project.sort_order !== null}
                isForcedVisible={isMenuActive || renderInExtendedSidebar}
              />
            )}
            <>
              {isAccordionMode ? (
                <CollapsiblePrimitive.Trigger
                  type="button"
                  className={cn("flex w-full flex-grow items-center gap-1.5 text-left select-none", {})}
                  aria-label={
                    isProjectListOpen
                      ? t("aria_labels.projects_sidebar.close_project_menu")
                      : t("aria_labels.projects_sidebar.open_project_menu")
                  }
                >
                  <div className="grid size-4 flex-shrink-0 place-items-center">
                    <Logo logo={project.logo_props} size={16} />
                  </div>
                  <p className="truncate text-13 font-medium text-secondary" title={project.name}>
                    {project.name}
                  </p>
                </CollapsiblePrimitive.Trigger>
              ) : (
                <ControlLink href={defaultTabUrl} className="flex flex-grow truncate" onClick={handleItemClick}>
                  <div className="flex w-full flex-grow items-center gap-1.5 text-left select-none">
                    <div className="grid size-4 flex-shrink-0 place-items-center">
                      <Logo logo={project.logo_props} size={16} />
                    </div>
                    <p className="truncate text-13 font-medium text-secondary" title={project.name}>
                      {project.name}
                    </p>
                  </div>
                </ControlLink>
              )}
              <div className="flex items-center gap-1">
                <ProjectQuickActionsMenu
                  workspaceSlug={workspaceSlug}
                  projectId={project.id}
                  isAdmin={isAdmin}
                  isAuthorized={isAuthorized}
                  isMenuActive={isMenuActive}
                  setIsMenuActive={setIsMenuActive}
                  handleCopyText={handleCopyText}
                  onPublish={() => setPublishModal(true)}
                  onLeave={handleLeaveProject}
                />
                {isAccordionMode && (
                  <IconButton
                    variant="ghost"
                    size="sm"
                    icon={ChevronRightIcon}
                    onClick={() => setIsProjectListOpen(!isProjectListOpen)}
                    className={cn("hidden text-placeholder group-hover/project-item:inline-flex", {
                      "inline-flex": isMenuActive,
                    })}
                    iconClassName={cn("transition-transform", {
                      "rotate-90": isProjectListOpen,
                    })}
                    aria-label={t(
                      isProjectListOpen
                        ? "aria_labels.projects_sidebar.close_project_menu"
                        : "aria_labels.projects_sidebar.open_project_menu"
                    )}
                  />
                )}
              </div>
            </>
          </div>
          {isAccordionMode && isProjectListOpen && (
            <>
              {isProjectListOpen && (
                <CollapsiblePrimitive.Panel className="relative mt-1 mb-1.5 flex flex-col gap-0.5 pl-6">
                  <div className="absolute top-0 bottom-1 left-[15px] w-[1px] bg-layer-3" />
                  <ProjectNavigation workspaceSlug={workspaceSlug} projectId={projectId.toString()} />
                </CollapsiblePrimitive.Panel>
              )}
            </>
          )}
          {isLastChild && <DropIndicator isVisible={instruction === "DRAG_BELOW"} />}
        </div>
      </CollapsiblePrimitive.Root>
    </>
  );
});
