/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { MenuPrimitive as Menu } from "@plane/propel/menu";
import { POPUP_CLASSNAME, POPUP_OPTION_CLASSNAME } from "@plane/propel/popover";
// ui
import { cn, getFileURL } from "@plane/utils";
// helpers
// hooks
import { useUser } from "@/hooks/store/user";
// components
import { SwitchAccountModal } from "./switch-account-modal";

type TSwitchAccountDropdownProps = {
  fullName?: string;
};

export const SwitchAccountDropdown = observer(function SwitchAccountDropdown(props: TSwitchAccountDropdownProps) {
  const { fullName } = props;
  // states
  const [showSwitchAccountModal, setShowSwitchAccountModal] = useState(false);
  // store hooks
  const { data: user } = useUser();

  const displayName = user?.first_name
    ? `${user?.first_name} ${user?.last_name ?? ""}`
    : fullName && fullName.trim().length > 0
      ? fullName
      : user?.email;

  if (!displayName && !fullName) return null;

  return (
    <>
      <SwitchAccountModal isOpen={showSwitchAccountModal} onClose={() => setShowSwitchAccountModal(false)} />
      <Menu.Root>
        <Menu.Trigger className="z-10 flex items-center gap-x-2.5 rounded-lg bg-layer-1 px-2 py-1.5">
          <div className="flex size-6 items-center justify-center rounded-full bg-success-primary text-13 font-semibold text-on-color capitalize">
            {user?.avatar_url ? (
              <img
                src={getFileURL(user?.avatar_url)}
                alt={user?.display_name}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <>{fullName?.[0] ?? "R"}</>
            )}
          </div>
          <span className="text-13 font-medium text-secondary">{displayName}</span>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner align="end" sideOffset={4} className="z-[120]">
            <Menu.Popup className={cn(POPUP_CLASSNAME, "min-w-48")}>
              <Menu.Item
                nativeButton
                render={<button type="button" />}
                className={cn(
                  POPUP_OPTION_CLASSNAME,
                  "whitespace-nowrap text-danger-primary data-[highlighted]:text-danger-primary"
                )}
                onClick={() => setShowSwitchAccountModal(true)}
              >
                Wrong e-mail address?
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </>
  );
});
