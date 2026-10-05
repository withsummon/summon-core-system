/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useTheme as useNextTheme } from "next-themes";
import { LogOut, UserCog2, Palette } from "lucide-react";
import { CustomMenu } from "@plane/ui";
import { MenuPrimitive } from "@plane/propel/menu";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
// plane internal packages
import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { authClient, useAdminAssetUrl } from "@/providers/instance.provider";
import { Avatar } from "@plane/ui";
// hooks
import { useTheme } from "@/hooks/store";
import { useAdminSession } from "@/providers/user.provider";

export const AdminSidebarDropdown = observer(function AdminSidebarDropdown() {
  // store hooks
  const { isSidebarCollapsed } = useTheme();
  const { authentication, authority } = useAdminSession();
  const currentUser = useQuery(api.identity.profile.get, authentication.isAuthenticated ? {} : "skip");
  const appearance = useQuery(api.identity.avatar.get, authentication.isAuthenticated ? {} : "skip");
  // hooks
  const { resolvedTheme, setTheme } = useNextTheme();
  // state
  const avatarUrl = useAdminAssetUrl(appearance?.avatar?.downloadPath);
  const [signingOut, setSigningOut] = useState(false);

  const handleThemeSwitch = () => {
    const newTheme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await authClient.signOut({ fetchOptions: { throw: true } });
    } finally {
      setSigningOut(false);
    }
  };

  const menuItems = (
    <>
      <div className="truncate border-b border-subtle px-2 py-2 text-secondary">{currentUser?.email}</div>
      <CustomMenu.MenuItem onClick={handleThemeSwitch}>
        <Palette className="size-4" />
        Switch to {resolvedTheme === "dark" ? "light" : "dark"} mode
      </CustomMenu.MenuItem>
      <MenuPrimitive.Item
        nativeButton
        render={
          <button
            type="button"
            disabled={signingOut}
            onClick={() => {
              void handleSignOut().catch((failure) =>
                setToast({
                  type: TOAST_TYPE.ERROR,
                  title: "Could not sign out",
                  message: failure instanceof Error ? failure.message : "Try again.",
                })
              );
            }}
          />
        }
        className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-secondary outline-none data-[highlighted]:bg-layer-transparent-hover"
      >
        <LogOut className="size-4" />
        Sign out
      </MenuPrimitive.Item>
    </>
  );

  return (
    <div className="flex max-h-header items-center gap-5 border-b border-subtle px-4 py-2.5">
      {isSidebarCollapsed ? (
        <CustomMenu
          ariaLabel="Admin account"
          customButton={<UserCog2 className="size-5" />}
          noChevron
          optionsClassName="w-52"
          placement="right-start"
        >
          {menuItems}
        </CustomMenu>
      ) : (
        <>
          <UserCog2 className="size-5 shrink-0 text-primary" />
          <h4 className="grow truncate text-body-md-medium text-primary">
            {authority?.isInstanceAdmin ? "Instance admin" : "Account"}
          </h4>
          {currentUser && (
            <CustomMenu
              ariaLabel="Admin account"
              customButton={<Avatar name={currentUser.displayName} src={avatarUrl} size={24} shape="square" />}
              noChevron
              optionsClassName="w-52"
              placement="bottom-end"
            >
              {menuItems}
            </CustomMenu>
          )}
        </>
      )}
    </div>
  );
});
