/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { MenuPrimitive as Menu } from "@plane/propel/menu";
// ui
import { cn } from "@plane/utils";
// helpers
// hooks
import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { AuthenticatedAssetImage } from "@/components/convex-core/assets/image";
// components
import { SwitchAccountModal } from "./switch-account-modal";

export function SwitchAccountDropdown({ disabled = false }: { disabled?: boolean }) {
  const [showSwitchAccountModal, setShowSwitchAccountModal] = useState(false);
  const profile = useQuery(api.identity.profile.get);
  const appearance = useQuery(api.identity.avatar.get);
  if (!profile) return null;
  const displayName = profile.firstName ? `${profile.firstName} ${profile.lastName}`.trim() : profile.email;
  return (
    <>
      <SwitchAccountModal isOpen={showSwitchAccountModal} onClose={() => setShowSwitchAccountModal(false)} />
      <Menu.Root>
        <Menu.Trigger
          disabled={disabled}
          className="z-10 flex items-center gap-x-2.5 rounded-lg bg-layer-1 px-2 py-1.5"
        >
          <div className="flex size-6 items-center justify-center rounded-full bg-success-primary text-13 font-semibold text-on-color capitalize">
            {appearance?.avatar ? (
              <AuthenticatedAssetImage
                asset={appearance.avatar}
                alt={profile.displayName}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              profile.firstName[0] || "R"
            )}
          </div>
          <span className="text-13 font-medium text-secondary">{displayName}</span>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner align="end" sideOffset={4} className="z-[120]">
            <Menu.Popup className="min-w-[12rem] rounded-md border-[0.5px] border-strong bg-surface-1 px-2 py-2.5 text-13 shadow-raised-200">
              <Menu.Item
                nativeButton
                render={<button type="button" />}
                className={({ highlighted: active }) =>
                  cn("w-full rounded-sm px-1 py-1.5 text-left whitespace-nowrap text-danger-primary", {
                    "bg-layer-1": active,
                  })
                }
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
}
