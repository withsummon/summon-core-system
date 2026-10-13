/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import useSWR from "swr";
import { summonService } from "@/services/summon.service";
import { formatMoney } from "./money";

/** Workspace currency code. Shares the settings page's request, so a saved currency applies everywhere. */
export function useWorkspaceCurrency(workspaceSlug: string) {
  const { data: settings } = useSWR(["summon-workspace-settings", workspaceSlug], () =>
    summonService.getWorkspaceSettings(workspaceSlug)
  );
  return settings?.currency || "IDR";
}

/** Money formatter in the workspace currency. */
export function useWorkspaceMoney(workspaceSlug: string) {
  const currency = useWorkspaceCurrency(workspaceSlug);
  return (value: string | null | undefined) => formatMoney(value, currency);
}
