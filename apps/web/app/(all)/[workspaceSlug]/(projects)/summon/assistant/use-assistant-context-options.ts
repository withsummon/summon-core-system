/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import useSWR from "swr";
import { summonService } from "@/services/summon.service";

/** Loads the optional focus sources and active Plane MCP credentials offered by the composer. */
export function useAssistantContextOptions(workspaceSlug: string) {
  return useSWR(["summon-assistant-context", workspaceSlug], async () => {
    const [clients, meetings, pages, credentials] = await Promise.all([
      summonService.listClients(workspaceSlug),
      summonService.listMeetings(workspaceSlug),
      summonService.listPageContexts(workspaceSlug),
      summonService.listCredentials(workspaceSlug),
    ]);
    return {
      clients,
      meetings,
      pages,
      credentials: credentials.filter(
        (credential) => credential.status === "active" && ["plane", "plane_mcp"].includes(credential.provider)
      ),
    };
  });
}
