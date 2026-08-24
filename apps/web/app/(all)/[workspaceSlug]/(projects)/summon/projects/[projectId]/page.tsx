/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import useSWR, { useSWRConfig } from "swr";
import { SummonRequestState } from "@/components/summon/request-state";
import { summonService } from "@/services/summon.service";
import { ProjectDetailWorkspace } from "./project-detail-workspace";
import type { Route } from "./+types/page";

function hasStatus(error: unknown, status: number) {
  if (typeof error !== "object" || error === null || !("response" in error)) return false;
  const { response } = error;
  return typeof response === "object" && response !== null && "status" in response && response.status === status;
}

export default function SummonProjectOverviewPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, projectId } = params;
  const { mutate: mutateCache } = useSWRConfig();
  const { data, error, isLoading, mutate } = useSWR(["summon-project-overview", workspaceSlug, projectId], () =>
    summonService.getProjectOverview(workspaceSlug, projectId)
  );

  if (!data) {
    if (hasStatus(error, 403)) return <SummonRequestState permissionError />;
    if (hasStatus(error, 404))
      return <SummonRequestState validationError="This project is unavailable or you no longer have access." />;
    return <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />;
  }

  const refresh = async () => {
    await Promise.all([mutate(), mutateCache(["summon-projects", workspaceSlug])]);
  };

  return (
    <ProjectDetailWorkspace overview={data} workspaceSlug={workspaceSlug} projectId={projectId} onRefresh={refresh} />
  );
}
