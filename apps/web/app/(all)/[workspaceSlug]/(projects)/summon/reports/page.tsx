/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useSearchParams } from "react-router";
import useSWR from "swr";
import { useProject } from "@/hooks/store/use-project";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";
import { ReportView } from "./report-view";
import { readReportFilters, reportRequestKey, type TReportFilterParam, updateReportFilter } from "./report-view-model";

export default function SummonReportsPage({ params }: Route.ComponentProps) {
  const workspaceSlug = params.workspaceSlug;
  const [searchParams, setSearchParams] = useSearchParams();
  const { joinedProjectIds, getProjectById } = useProject();
  const filters = readReportFilters(searchParams);
  const { data, error, isLoading, mutate } = useSWR(reportRequestKey(workspaceSlug, filters), () =>
    summonService.getReport(workspaceSlug, filters)
  );
  const { data: clients = [] } = useSWR(["summon-report-clients", workspaceSlug], () =>
    summonService.listClients(workspaceSlug)
  );

  const updateFilter = (name: TReportFilterParam, value: string) => {
    setSearchParams(updateReportFilter(searchParams, name, value), { replace: true });
  };

  return (
    <ReportView
      data={data}
      error={error}
      isLoading={isLoading}
      filters={filters}
      projects={joinedProjectIds.map((id) => ({ id, name: getProjectById(id)?.name ?? id }))}
      clients={clients}
      exportUrl={summonService.getReportExportUrl(workspaceSlug, filters)}
      onFilterChange={updateFilter}
      onRetry={() => void mutate()}
    />
  );
}
