/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import useSWR from "swr";
import { PageHead } from "@/components/core/page-title";
import { OpportunityInspector } from "@/components/summon/opportunities/opportunity-inspector";
import { opportunitiesHref } from "@/components/summon/opportunities/opportunity-pipeline";
import { SummonRequestState } from "@/components/summon/request-state";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";

export default function SummonOpportunityDetailPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, opportunityId } = params;
  const { data, error, isLoading, mutate } = useSWR(["summon-opportunity", workspaceSlug, opportunityId], () =>
    summonService.getOpportunityDetail(workspaceSlug, opportunityId)
  );

  return (
    <section className="mx-auto w-full max-w-4xl p-4 lg:p-5">
      <PageHead title={`${data?.title ?? "Opportunity"} · Summon Core`} />
      {data ? (
        <OpportunityInspector
          workspaceSlug={workspaceSlug}
          detail={data}
          onChanged={() => mutate()}
          backHref={opportunitiesHref(workspaceSlug, { stage: data.stage, opportunity: data.id })}
        />
      ) : (
        <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />
      )}
    </section>
  );
}
