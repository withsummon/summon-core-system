import { useOutletContext } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { PageHead } from "@/components/core/page-title";
import type { WorkspaceSession } from "@/app/native-workspace";
import { OpportunityInspector } from "@/components/summon/opportunities/opportunity-inspector";
import { opportunitiesHref } from "@/components/summon/opportunities/opportunity-pipeline";
import { SummonRequestState } from "@/components/summon/request-state";
import type { Route } from "./+types/page";

export default function SummonOpportunityDetailPage({ params }: Route.ComponentProps) {
  const { workspace } = useOutletContext<WorkspaceSession>();
  const context = useQuery(api.commercial.opportunities.get, {
    workspaceId: workspace._id,
    opportunityId: params.opportunityId,
    clientId: null,
  });
  return (
    <section className="mx-auto w-full max-w-4xl p-4 lg:p-5">
      <PageHead title={`${context?.record?.title ?? "Opportunity"} · Summon Core`} />
      {context ? (
        <OpportunityInspector
          key={context.record?._id}
          workspace={workspace}
          context={context}
          backHref={opportunitiesHref(workspace.slug, {
            stage: context.record?.stage,
            opportunity: context.record?._id,
          })}
        />
      ) : (
        <SummonRequestState loading />
      )}
    </section>
  );
}
