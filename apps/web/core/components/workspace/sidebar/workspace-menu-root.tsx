/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { EnvelopeSimpleIcon, GearSixIcon, PlusCircleIcon, SignOutIcon, UserPlusIcon } from "@phosphor-icons/react";
// plane imports
import { EUserPermissions } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { ChevronDownIcon } from "@plane/propel/icons";
import { MENU_ITEM_CLASSNAME, MENU_POPUP_CLASSNAME, MenuPrimitive as Menu } from "@plane/propel/menu";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IWorkspace } from "@plane/types";
import { Loader } from "@plane/ui";
import { orderWorkspacesList, cn } from "@plane/utils";
// helpers
import { AppSidebarItem } from "@/components/sidebar/sidebar-item";
// hooks
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUser, useUserProfile } from "@/hooks/store/user";
import { useInstance } from "@/hooks/store/use-instance";
// components
import { WorkspaceLogo } from "../logo";
import SidebarDropdownItem from "./dropdown-item";

type WorkspaceMenuRootProps = {
  variant: "sidebar" | "top-navigation";
};

export const WorkspaceMenuRoot = observer(function WorkspaceMenuRoot(props: WorkspaceMenuRootProps) {
  const { variant } = props;
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  // store hooks
  const { toggleSidebar } = useAppTheme();
  const { config } = useInstance();
  const { data: currentUser } = useUser();
  const { signOut } = useUser();
  const { updateUserProfile } = useUserProfile();
  const { currentWorkspace: activeWorkspace, workspaces } = useWorkspace();
  // derived values
  const isWorkspaceCreationDisabled = config?.is_workspace_creation_disabled ?? false;
  const isAdmin = activeWorkspace?.role === EUserPermissions.ADMIN;
  // translation
  const { t } = useTranslation();
  const handleWorkspaceNavigation = (workspace: IWorkspace) => updateUserProfile({ last_workspace_id: workspace?.id });

  const handleSignOut = async () => {
    await signOut().catch(() =>
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("auth.sign_out.toast.error.title"),
        message: t("auth.sign_out.toast.error.message"),
      })
    );
  };

  const handleItemClick = () => {
    if (window.innerWidth < 768) {
      toggleSidebar();
    }
  };
  const workspacesList = orderWorkspacesList(Object.values(workspaces ?? {}));
  // The current workspace leads the list.
  const orderedWorkspaces = activeWorkspace
    ? [activeWorkspace, ...workspacesList.filter((workspace) => workspace.id !== activeWorkspace.id)]
    : workspacesList;

  return (
    <Menu.Root open={open} onOpenChange={setOpen}>
      <div
        className={cn("relative flex h-full w-fit max-w-48", {
          "w-full justify-center": variant === "sidebar",
          "min-w-0 flex-grow": variant === "top-navigation",
        })}
      >
        {variant === "sidebar" && (
          <Menu.Trigger
            className={cn("flex size-8 w-full items-center justify-center rounded-md", {
              "bg-layer-1": open,
            })}
          >
            <AppSidebarItem.Icon
              icon={
                <WorkspaceLogo
                  logo={activeWorkspace?.logo_url}
                  name={activeWorkspace?.name}
                  classNames="size-8 rounded-md border border-subtle"
                />
              }
            />
          </Menu.Trigger>
        )}
        {variant === "top-navigation" && (
          <Menu.Trigger
            className={cn(
              "group/menu-button flex min-w-0 flex-grow items-center justify-between gap-1 truncate rounded-sm p-1 text-13 font-medium text-secondary hover:bg-layer-1 focus-visible:outline-2 focus-visible:outline-accent-strong focus-visible:outline-solid",
              {
                "bg-layer-1": open,
              }
            )}
            aria-label={t("aria_labels.projects_sidebar.open_workspace_switcher")}
          >
            <div className="flex min-w-0 flex-grow items-center gap-2 truncate">
              <WorkspaceLogo
                logo={activeWorkspace?.logo_url}
                name={activeWorkspace?.name}
                classNames="border border-subtle rounded-md size-7"
              />
              <h4 className="truncate text-14 font-medium text-primary">{activeWorkspace?.name ?? t("loading")}</h4>
            </div>
            <ChevronDownIcon
              className={cn("size-4 flex-shrink-0 text-placeholder duration-300", {
                "rotate-180": open,
              })}
            />
          </Menu.Trigger>
        )}
        <Menu.Portal>
          <Menu.Positioner align="start" sideOffset={6} className="z-[120]">
            <Menu.Popup className={cn(MENU_POPUP_CLASSNAME, "w-72 max-w-[calc(100vw-2rem)]")}>
              <p className="truncate px-2 pt-1.5 pb-1 text-12 text-tertiary">{currentUser?.email}</p>
              {workspacesList ? (
                <div className="vertical-scrollbar grid scrollbar-sm max-h-80 gap-0.5 overflow-y-auto">
                  {orderedWorkspaces.map((workspace) => (
                    <SidebarDropdownItem
                      key={workspace.id}
                      workspace={workspace}
                      isActive={workspace.id === activeWorkspace?.id}
                      onSelect={() => {
                        handleItemClick();
                        handleWorkspaceNavigation(workspace);
                        close();
                      }}
                    />
                  ))}
                </div>
              ) : (
                <Loader className="space-y-1 p-1">
                  <Loader.Item height="40px" />
                  <Loader.Item height="40px" />
                </Loader>
              )}

              {isAdmin && activeWorkspace ? (
                <>
                  <Menu.Separator className="-mx-1 my-1 h-px bg-(--border-color-subtle)" />
                  <Menu.Item
                    render={<Link href={`/${activeWorkspace.slug}/summon/settings`} />}
                    onClick={handleItemClick}
                    className={MENU_ITEM_CLASSNAME}
                  >
                    <GearSixIcon className="size-4 flex-none text-tertiary" />
                    Workspace settings
                  </Menu.Item>
                  <Menu.Item
                    render={<Link href={`/${activeWorkspace.slug}/summon/settings/users`} />}
                    onClick={handleItemClick}
                    className={MENU_ITEM_CLASSNAME}
                  >
                    <UserPlusIcon className="size-4 flex-none text-tertiary" />
                    Invite people
                  </Menu.Item>
                </>
              ) : null}

              <Menu.Separator className="-mx-1 my-1 h-px bg-(--border-color-subtle)" />
              {!isWorkspaceCreationDisabled && (
                <Menu.Item
                  render={<Link href="/create-workspace" />}
                  onClick={handleItemClick}
                  className={MENU_ITEM_CLASSNAME}
                >
                  <PlusCircleIcon className="size-4 flex-none text-tertiary" />
                  {t("create_workspace")}
                </Menu.Item>
              )}
              <Menu.Item
                render={<Link href="/invitations" />}
                onClick={handleItemClick}
                className={MENU_ITEM_CLASSNAME}
              >
                <EnvelopeSimpleIcon className="size-4 flex-none text-tertiary" />
                {t("workspace_invites")}
              </Menu.Item>
              <Menu.Item
                nativeButton
                render={<button type="button" />}
                onClick={handleSignOut}
                className={cn(MENU_ITEM_CLASSNAME, "text-danger-primary data-[highlighted]:bg-danger-subtle")}
              >
                <SignOutIcon className="size-4 flex-none" />
                {t("sign_out")}
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </div>
    </Menu.Root>
  );
});
