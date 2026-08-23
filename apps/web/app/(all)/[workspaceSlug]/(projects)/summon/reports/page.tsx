/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useProject } from "@/hooks/store/use-project";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";
import { ReportView } from "./report-view";
import { readReportFilters, reportRequestKey, updateReportFilter, type TReportFilterParam } from "./report-view-model";

export default function SummonReportsPage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { joinedProjectIds, getProjectById } = useProject();
  const filters = readReportFilters(searchParams);
  const { data, error, isLoading, mutate } = useSWR(reportRequestKey(workspaceSlug, filters), () =>
    summonService.getReport(workspaceSlug, filters)
  );
  const { data: clients = [] } = useSWR(["summon-clients", workspaceSlug], () =>
    summonService.listClients(workspaceSlug)
  );
  const projects = useMemo(
    () => joinedProjectIds.map((id) => ({ id, name: getProjectById(id)?.name || id })),
    [getProjectById, joinedProjectIds]
  );

  const onFilterChange = (name: TReportFilterParam, value: string) => {
    const next = updateReportFilter(searchParams, name, value);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`);
  };

  return (
    <ReportView
      workspaceSlug={workspaceSlug}
      data={data}
      error={error}
      isLoading={isLoading}
      filters={filters}
      projects={projects}
      clients={clients}
      exportUrl={summonService.getReportExportUrl(workspaceSlug, filters)}
      onFilterChange={onFilterChange}
      onRetry={() => void mutate()}
    />
  );
}
