import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { FunctionReturnType } from "convex/server";
import type { Doc, Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import {
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_LABEL,
  OPPORTUNITY_STAGE_TONE,
} from "@/components/summon/opportunities/opportunity-pipeline";
import { OpportunityForm } from "./opportunity-form";
import { Delivery } from "./delivery";
import { cardClass, DeleteRecord, mutationMessage, selectClass } from "./forms";

export function Opportunities({
  workspace,
}: {
  workspace: FunctionReturnType<typeof api.workspaces.index.list>[number];
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.commercial.opportunities.list,
    { workspaceId: workspace._id },
    { initialNumItems: 50 }
  );
  const [selected, setSelected] = useState<Id<"opportunities"> | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const opportunity = useQuery(
    api.commercial.opportunities.get,
    selected ? { workspaceId: workspace._id, opportunityId: selected } : "skip"
  );
  if (selected && !opportunity) return <p role="status">Loading opportunity…</p>;
  if (opportunity)
    return (
      <OpportunityDetail
        key={opportunity._id}
        opportunity={opportunity}
        workspace={workspace}
        onBack={() => setSelected(null)}
      />
    );
  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-secondary">{workspace.name}</p>
          <h1 className="text-2xl font-semibold">Opportunities</h1>
        </div>
        {workspace.membershipRole !== "guest" && <Button onClick={() => setCreating(true)}>Add opportunity</Button>}
      </header>
      {workspace.membershipRole !== "guest" && creating && (
        <OpportunityForm
          workspaceId={workspace._id}
          opportunity={null}
          onDone={(id) => {
            setCreating(false);
            setSelected(id);
          }}
          onCancel={() => setCreating(false)}
        />
      )}
      <div className="flex flex-wrap gap-3">
        <Input
          aria-label="Filter loaded opportunities"
          placeholder="Filter loaded opportunities"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          aria-label="Filter by stage"
          className={selectClass}
          value={stage}
          onChange={(event) => setStage(event.target.value)}
        >
          <option value="">All stages</option>
          {OPPORTUNITY_STAGES.map((value) => (
            <option key={value} value={value}>
              {OPPORTUNITY_STAGE_LABEL[value]}
            </option>
          ))}
        </select>
      </div>
      {status === "LoadingFirstPage" && <p role="status">Loading opportunities…</p>}
      <div className="space-y-3">
        {results
          .filter((item) => (!stage || item.stage === stage) && item.title.toLowerCase().includes(search.toLowerCase()))
          .map((item) => (
            <button
              key={item._id}
              className={`${cardClass} grid w-full gap-3 text-left sm:grid-cols-[minmax(0,1fr)_auto]`}
              onClick={() => setSelected(item._id)}
            >
              <div className="min-w-0">
                <h2 className="font-semibold break-words">{item.title}</h2>
                <p className="text-sm mt-1 text-secondary">{item.product || "Product not set"}</p>
                <p className="text-sm mt-2 text-secondary">
                  Value: {item.value ?? "Not set"} · Probability: {item.probability}%
                </p>
              </div>
              <span className={`text-xs self-start rounded-full px-3 py-1 ${OPPORTUNITY_STAGE_TONE[item.stage].chip}`}>
                {OPPORTUNITY_STAGE_LABEL[item.stage]}
              </span>
            </button>
          ))}
      </div>
      {status === "Exhausted" && !results.length && <p className="text-sm text-secondary">No opportunities yet.</p>}
      {status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => loadMore(50)}>
          Load more opportunities
        </Button>
      )}
    </section>
  );
}
function OpportunityDetail({
  opportunity,
  workspace,
  onBack,
}: {
  opportunity: Doc<"opportunities">;
  workspace: FunctionReturnType<typeof api.workspaces.index.list>[number];
  onBack: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const remove = useMutation(api.commercial.opportunities.remove);
  const canWrite = workspace.membershipRole !== "guest";
  return (
    <article className="space-y-5">
      <Button variant="secondary" onClick={onBack}>
        Back to opportunities
      </Button>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{opportunity.title}</h1>
          <p className="text-sm mt-1 text-secondary">{opportunity.product}</p>
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit opportunity
            </Button>
            <DeleteRecord
              label="opportunity"
              onDelete={async () => {
                await remove({ workspaceId: workspace._id, opportunityId: opportunity._id });
                onBack();
              }}
            />
          </div>
        )}
      </header>
      {canWrite && editing && (
        <OpportunityForm
          workspaceId={workspace._id}
          opportunity={opportunity}
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      )}
      <StageControl opportunity={opportunity} canWrite={canWrite} />
      <dl className={`${cardClass} grid gap-4 sm:grid-cols-3`}>
        <div>
          <dt className="text-xs text-secondary">Value</dt>
          <dd className="mt-1 font-medium break-all">{opportunity.value ?? "Not set"}</dd>
        </div>
        <div>
          <dt className="text-xs text-secondary">Probability</dt>
          <dd className="mt-1 font-medium">{opportunity.probability}%</dd>
        </div>
        <div>
          <dt className="text-xs text-secondary">Expected close</dt>
          <dd className="mt-1 font-medium">{opportunity.expectedCloseDate ?? "Not set"}</dd>
        </div>
      </dl>
      <section className={cardClass}>
        <h2 className="font-semibold">Description</h2>
        <p className="text-sm mt-3 break-words whitespace-pre-wrap text-secondary">
          {opportunity.description || "No description yet."}
        </p>
        <p className="text-xs mt-3 text-secondary">Source: {opportunity.source || "Not set"}</p>
      </section>
      <Delivery opportunity={opportunity} workspace={workspace} />
    </article>
  );
}
function StageControl({ opportunity, canWrite }: { opportunity: Doc<"opportunities">; canWrite: boolean }) {
  const transition = useMutation(api.commercial.opportunities.transition);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="space-y-2">
      <label className="text-sm flex max-w-xs flex-col gap-2">
        Stage
        <select
          className={selectClass}
          value={opportunity.stage}
          disabled={!canWrite || pending}
          onChange={async (event) => {
            const stage = OPPORTUNITY_STAGES.find((value) => value === event.target.value);
            if (!stage) return;
            setPending(true);
            setError("");
            try {
              await transition({ workspaceId: opportunity.workspaceId, opportunityId: opportunity._id, stage });
            } catch (failure) {
              setError(mutationMessage(failure));
            } finally {
              setPending(false);
            }
          }}
        >
          {OPPORTUNITY_STAGES.map((value) => (
            <option key={value} value={value}>
              {OPPORTUNITY_STAGE_LABEL[value]}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}
