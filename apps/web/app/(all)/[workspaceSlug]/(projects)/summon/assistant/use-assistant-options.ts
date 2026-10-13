/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import useSWR from "swr";
import { useProject } from "@/hooks/store/use-project";
import { summonService } from "@/services/summon.service";
import { scopeOptionsFrom } from "./assistant-composer";

/**
 * What the person can point the Assistant at: their projects, the clients and meetings they can see,
 * pages with Summon context, and active Plane MCP credentials.
 */
export function useAssistantOptions(workspaceSlug: string) {
  const { joinedProjectIds, getProjectById } = useProject();
  const { data, error } = useSWR(["summon-assistant-context", workspaceSlug], async () => {
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
  const projects = joinedProjectIds.map((id) => {
    const project = getProjectById(id);
    return { id, label: project?.name ?? id, identifier: project?.identifier ?? "" };
  });
  return {
    projects,
    scopeOptions: scopeOptionsFrom(projects, data?.clients, data?.meetings),
    meetings: data?.meetings ?? [],
    pages: data?.pages ?? [],
    credentials: data?.credentials ?? [],
    error,
  };
}
