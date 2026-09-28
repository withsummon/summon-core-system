/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { AuthenticatedAssetImage } from "@/components/convex-core/assets/image";
// plane imports
import { Avatar } from "@plane/ui";
// hooks

export function ProfileSettingsSidebarHeader() {
  const currentUser = useQuery(api.identity.profile.get);
  const appearance = useQuery(api.identity.avatar.get);

  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="shrink-0">
        {appearance?.avatar ? (
          <AuthenticatedAssetImage
            asset={appearance.avatar}
            alt="Profile photo"
            className="size-8 rounded-full object-cover"
          />
        ) : (
          <Avatar name={currentUser?.displayName} size={32} shape="circle" className="text-16" />
        )}
      </div>
      <div className="truncate">
        <p className="truncate text-body-sm-medium">
          {currentUser?.firstName} {currentUser?.lastName}
        </p>
        <p className="truncate text-caption-md-regular">{currentUser?.email}</p>
      </div>
    </div>
  );
}
