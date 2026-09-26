/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useTheme as useNextTheme } from "next-themes";
import { LogOut, UserCog2, Palette } from "lucide-react";
import { CustomMenu } from "@plane/ui";
import { MenuPrimitive } from "@plane/propel/menu";
// plane internal packages
import { API_BASE_URL } from "@plane/constants";
import { AuthService } from "@plane/services";
import { Avatar } from "@plane/ui";
import { getFileURL } from "@plane/utils";
// hooks
import { useTheme, useUser } from "@/hooks/store";

// service initialization
const authService = new AuthService();

export const AdminSidebarDropdown = observer(function AdminSidebarDropdown() {
  // store hooks
  const { isSidebarCollapsed } = useTheme();
  const { currentUser, signOut } = useUser();
  // hooks
  const { resolvedTheme, setTheme } = useNextTheme();
  // state
  const [csrfToken, setCsrfToken] = useState<string | undefined>(undefined);

  const handleThemeSwitch = () => {
    const newTheme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  };

  const handleSignOut = () => signOut();

  const menuItems = (
    <>
      <div className="truncate border-b border-subtle px-2 py-2 text-secondary">{currentUser?.email}</div>
      <CustomMenu.MenuItem onClick={handleThemeSwitch}>
        <Palette className="size-4" />
        Switch to {resolvedTheme === "dark" ? "light" : "dark"} mode
      </CustomMenu.MenuItem>
      <form method="POST" action={`${API_BASE_URL}/api/instances/admins/sign-out/`} onSubmit={handleSignOut}>
        <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />
        <MenuPrimitive.Item
          nativeButton
          render={<button type="submit" />}
          className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-secondary outline-none data-[highlighted]:bg-layer-transparent-hover"
        >
          <LogOut className="size-4" />
          Sign out
        </MenuPrimitive.Item>
      </form>
    </>
  );

  useEffect(() => {
    if (csrfToken === undefined)
      void authService.requestCSRFToken().then((data) => data?.csrf_token && setCsrfToken(data.csrf_token));
  }, [csrfToken]);

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
          <h4 className="grow truncate text-body-md-medium text-primary">Instance admin</h4>
          {currentUser && (
            <CustomMenu
              ariaLabel="Admin account"
              customButton={
                <Avatar
                  name={currentUser.display_name}
                  src={getFileURL(currentUser.avatar_url)}
                  size={24}
                  shape="square"
                />
              }
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
