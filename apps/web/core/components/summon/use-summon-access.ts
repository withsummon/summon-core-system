/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import useSWR from "swr";
import type { TSummonCapability } from "@plane/types";
import { summonService } from "@/services/summon.service";

/**
 * What the signed-in user may do in this workspace, read from the API's capability map.
 * Hidden navigation is not authorization: screens gate on this, and the API enforces it again.
 */
export function useSummonAccess(workspaceSlug: string) {
  const { data, error, isLoading } = useSWR(["summon-access", workspaceSlug], () =>
    summonService.getAccess(workspaceSlug)
  );
  return {
    access: data,
    error,
    isLoading,
    can: (capability: TSummonCapability) => Boolean(data?.capabilities.includes(capability)),
  };
}
