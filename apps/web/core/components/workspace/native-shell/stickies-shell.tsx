import { EUserWorkspaceRoles } from "@plane/types";
import { useEffect, useState, useRef } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { authClient } from "@/components/convex-core/provider";
import { useMutation } from "convex/react";
import { api } from "@summon/convex/api";
import {
  SIDEBAR_WIDTH,
  EXTENDED_SIDEBAR_WIDTH,
  SUMMON_WORKSPACE_NAVIGATION_ITEMS,
  SUMMON_ASSISTANT_NAVIGATION_ITEM,
  WORKSPACE_SIDEBAR_DYNAMIC_NAVIGATION_ITEMS_LINKS,
} from "@plane/constants";
import { useLocalStorage, useOutsideClickDetector } from "@plane/hooks";
import { useTranslation } from "@plane/i18n";
import { IconButton } from "@plane/propel/icon-button";
import { InboxIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { PanelLeft, Ellipsis } from "lucide-react";
import { joinUrlPath } from "@plane/utils";
import { WorkspaceProjectFrame } from "../project-frame";
import { WorkspaceContentFrame } from "../content-frame";
import { WorkspaceTopNavigation } from "@/components/navigation/workspace-top-navigation";
import { SidebarContent } from "@/components/sidebar/sidebar-content";
import { ResizableSidebar } from "@/components/sidebar/resizable-sidebar";
import { SidebarNavItem } from "@/components/sidebar/sidebar-navigation";
import { WorkspaceSidebarLink } from "../sidebar/sidebar-link";
import { SummonThemeToggle } from "@/components/summon/theme-toggle";
import { NativeHelpMenu } from "./help-menu";
import { NativeAccountMenu } from "./account-menu";
import { NativeWorkspaceMenu } from "./workspace-menu";
import { StickyCommands } from "./commands";
import type { NativeWorkspace, NativeProfile } from "./types";
export function PreservedStickiesShell({
  workspace,
  workspaces,
  user,
  children,
  onCreateSticky,
  onOpenStickies,
  beforeLeave,
}: {
  workspace: NativeWorkspace;
  workspaces: NativeWorkspace[];
  user: NativeProfile;
  children: ReactNode;
  onCreateSticky: () => Promise<void>;
  onOpenStickies: () => void;
  beforeLeave: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const savePreferences = useMutation(api.identity.preferences.save);
  const { storedValue, setValue } = useLocalStorage("sidebarWidth", SIDEBAR_WIDTH);
  const [width, setWidth] = useState(storedValue ?? SIDEBAR_WIDTH);
  const { storedValue: storedCollapsed, setValue: storeCollapsed } = useLocalStorage("app_sidebar_collapsed", false);
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 768 || storedCollapsed === true);
  const sidebarRef = useRef<HTMLDivElement>(null);
  useOutsideClickDetector(sidebarRef, () => {
    if (window.innerWidth < 768) setCollapsed(true);
  });
  const [peek, setPeek] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  useEffect(() => {
    const resize = () => {
      if (window.innerWidth < 768) {
        setCollapsed(true);
        setPeek(false);
      }
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const toggle = (value?: boolean) => {
    const next = value ?? !collapsed;
    setCollapsed(next);
    storeCollapsed(next);
    setPeek(false);
    setAdvanced(false);
  };
  const leave = async () => {
    try {
      await beforeLeave();
      await authClient.signOut({ fetchOptions: { throw: true } });
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("auth.sign_out.toast.error.title"),
        message: error instanceof Error ? error.message : t("auth.sign_out.toast.error.message"),
      });
    }
  };
  const role = {
    admin: EUserWorkspaceRoles.ADMIN,
    member: EUserWorkspaceRoles.MEMBER,
    guest: EUserWorkspaceRoles.GUEST,
  }[workspace.membershipRole];
  const link = (item: typeof SUMMON_ASSISTANT_NAVIGATION_ITEM) => (
    <WorkspaceSidebarLink
      key={item.key}
      item={item}
      href={joinUrlPath(workspace.slug, item.href)}
      pathname={pathname}
      onClick={() => {
        setAdvanced(false);
        if (window.innerWidth < 768) setCollapsed(true);
      }}
    />
  );
  const toggleButton = (
    <IconButton
      size="base"
      variant="ghost"
      icon={PanelLeft}
      aria-label={t(
        collapsed ? "aria_labels.projects_sidebar.expand_sidebar" : "aria_labels.projects_sidebar.collapse_sidebar"
      )}
      onClick={() => toggle()}
    />
  );
  const theme = async (value: "light" | "dark") => {
    try {
      await savePreferences({
        expectedRevision: user.revision,
        preferences: { ...user.preferences, theme: { ...user.preferences.theme, theme: value } },
      });
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Unable to save theme",
        message: error instanceof Error ? error.message : "Try again.",
      });
    }
  };
  return (
    <WorkspaceContentFrame
      shouldRenderAppRail={false}
      appRail={null}
      topNavigation={
        <WorkspaceTopNavigation
          showLabel
          sidebarCollapsed={collapsed}
          sidebarToggle={toggleButton}
          workspaceMenu={
            <NativeWorkspaceMenu
              workspace={workspace}
              workspaces={workspaces}
              user={user}
              onSignOut={() => void leave()}
              beforeLeave={beforeLeave}
            />
          }
          powerK={<StickyCommands onCreateSticky={onCreateSticky} onOpenStickies={onOpenStickies} />}
          actions={
            <>
              <Link
                href={`/${workspace.slug}/notifications/`}
                aria-label="Inbox"
                title="Inbox"
                className="grid size-8 place-items-center rounded-md text-tertiary hover:bg-layer-transparent-hover"
              >
                <span className="relative">
                  <InboxIcon className="size-5" />
                </span>
              </Link>
              <NativeHelpMenu />
              <SummonThemeToggle onChange={theme} />
              <div className="flex size-8 items-center justify-center rounded-md hover:bg-layer-1-hover">
                <NativeAccountMenu profile={user} onSignOut={() => void leave()} beforeLeave={beforeLeave} />
              </div>
            </>
          }
        />
      }
    >
      <WorkspaceProjectFrame
        sidebar={
          <ResizableSidebar
            showPeek={peek}
            width={width}
            setWidth={setWidth}
            onWidthChange={setValue}
            isCollapsed={collapsed}
            toggleCollapsed={toggle}
            togglePeek={(value) => setPeek((current) => value ?? !current)}
            peekDuration={1500}
            isAnyExtendedSidebarExpanded={advanced}
            extendedSidebar={
              advanced ? (
                <div
                  id="extended-sidebar-toggle"
                  className="shadow-sm absolute z-[21] flex h-full transform flex-col border-r border-subtle bg-surface-1 p-4 py-2 transition-all duration-300 ease-in-out"
                  style={{ left: width, width: EXTENDED_SIDEBAR_WIDTH }}
                >
                  {WORKSPACE_SIDEBAR_DYNAMIC_NAVIGATION_ITEMS_LINKS.filter((item) => item.access.includes(role)).map(
                    link
                  )}
                </div>
              ) : undefined
            }
          >
            <SidebarContent title="Summon Core" actions={toggleButton} containerRef={sidebarRef}>
              <div className="flex min-h-full flex-col">
                <div className="flex flex-col gap-0.5">
                  {SUMMON_WORKSPACE_NAVIGATION_ITEMS.filter((item) => item.access.includes(role)).map(link)}
                  {workspace.membershipRole === "admin" && (
                    <SidebarNavItem>
                      <button
                        type="button"
                        onClick={() => setAdvanced((value) => !value)}
                        className="flex flex-grow items-center gap-1.5 py-px text-13 font-medium text-tertiary"
                        id="extended-sidebar-toggle"
                        aria-label={`${advanced ? "Close" : "Open"} Advanced Plane`}
                      >
                        <Ellipsis className="size-4 flex-shrink-0" />
                        <span>Advanced Plane</span>
                      </button>
                    </SidebarNavItem>
                  )}
                </div>
                <div className="mt-auto border-t border-subtle pt-2">{link(SUMMON_ASSISTANT_NAVIGATION_ITEM)}</div>
              </div>
            </SidebarContent>
          </ResizableSidebar>
        }
      >
        {children}
      </WorkspaceProjectFrame>
    </WorkspaceContentFrame>
  );
}
