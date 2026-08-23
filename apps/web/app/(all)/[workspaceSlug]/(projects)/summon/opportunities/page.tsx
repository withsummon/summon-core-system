/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Plus, Search } from "lucide-react";
import { Button, Input } from "@plane/ui";
import type { TSummonOpportunityStage } from "@plane/types";
import { SummonField, SummonSelect } from "@/components/summon/forms";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonCard, SummonMetric, SummonScreen, summonErrorMessage } from "@/components/summon/screen";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";

const stages: TSummonOpportunityStage[] = ["lead", "qualified", "proposal", "negotiation", "won", "lost"];

export default function SummonOpportunitiesPage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<"all" | TSummonOpportunityStage>("all");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const { data, error, isLoading, mutate } = useSWR(["summon-opportunities", workspaceSlug], () =>
    summonService.listOpportunities(workspaceSlug)
  );
  const { data: clients = [] } = useSWR(["summon-clients", workspaceSlug], () =>
    summonService.listClients(workspaceSlug)
  );
  const opportunities = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (data ?? []).filter(
      (item) =>
        (stage === "all" || item.stage === stage) &&
        [item.title, item.product, item.source].some((value) => value.toLowerCase().includes(normalized))
    );
  }, [data, query, stage]);

  const createOpportunity = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setCreating(true);
    setFormError("");
    try {
      await summonService.createOpportunity(workspaceSlug, {
        title: form.get("title"),
        client: form.get("client") || null,
        product: form.get("product"),
        source: form.get("source"),
        value: form.get("value") || null,
        probability: Number(form.get("probability")),
        expected_close_date: form.get("expected_close_date") || null,
        description: form.get("description"),
        stage: "lead",
      });
      event.currentTarget.reset();
      await mutate();
    } catch (requestError) {
      setFormError(summonErrorMessage(requestError));
    } finally {
      setCreating(false);
    }
  };

  const openCount = data?.filter((item) => !["won", "lost"].includes(item.stage)).length ?? 0;
  const wonCount = data?.filter((item) => item.stage === "won").length ?? 0;

  return (
    <SummonScreen
      title="Opportunities"
      description="A persisted commercial pipeline connected to clients and Plane delivery work."
      actions={
        <div className="relative block w-72 max-w-full">
          <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-tertiary" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search opportunities"
            className="pl-8"
          />
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <SummonMetric label="Open pipeline" value={openCount} detail="Lead through negotiation" />
        <SummonMetric label="Won" value={wonCount} detail="Persisted won opportunities" />
        <SummonMetric label="Forecast" value="—" detail="No currency conversion source" />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["all", ...stages] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setStage(item)}
            className={`text-xs rounded-full border px-3 py-1.5 capitalize ${stage === item ? "border-accent-primary bg-accent-primary text-white" : "border-subtle bg-surface-1 text-secondary"}`}
          >
            {item}{" "}
            {item === "all"
              ? (data?.length ?? 0)
              : (data?.filter((opportunity) => opportunity.stage === item).length ?? 0)}
          </button>
        ))}
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        {!data ? (
          <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />
        ) : opportunities.length === 0 ? (
          <SummonRequestState empty emptyMessage="No opportunities match this pipeline filter." />
        ) : (
          <SummonCard className="overflow-x-auto p-0">
            <table className="text-xs w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-subtle bg-layer-1 text-[10px] text-tertiary uppercase">
                  <th className="px-4 py-3">Opportunity</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">Close</th>
                  <th className="px-4 py-3">Probability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {opportunities.map((opportunity) => (
                  <tr key={opportunity.id} className="hover:bg-layer-1">
                    <td className="px-4 py-3">
                      <Link
                        href={`/${workspaceSlug}/summon/opportunities/${opportunity.id}`}
                        className="font-medium text-primary hover:text-accent-primary"
                      >
                        {opportunity.title}
                      </Link>
                      <p className="mt-1 text-[10px] text-secondary">{opportunity.source || "Source not set"}</p>
                    </td>
                    <td className="px-4 py-3 text-secondary capitalize">{opportunity.stage}</td>
                    <td className="px-4 py-3 text-secondary">{opportunity.product || "Not set"}</td>
                    <td className="px-4 py-3 font-medium text-primary">{opportunity.value || "Not set"}</td>
                    <td className="px-4 py-3 text-secondary">{opportunity.expected_close_date || "Not set"}</td>
                    <td className="px-4 py-3 text-secondary">{opportunity.probability}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SummonCard>
        )}
        <SummonCard>
          <div className="flex items-center gap-2">
            <Plus className="size-4 text-accent-primary" />
            <h2 className="text-sm font-semibold text-primary">New opportunity</h2>
          </div>
          <form onSubmit={createOpportunity} className="mt-4 grid gap-3">
            <Input name="title" required placeholder="Opportunity title" />
            <SummonField label="Client">
              <SummonSelect name="client" defaultValue="">
                <option value="">No client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </SummonSelect>
            </SummonField>
            <Input name="product" placeholder="Product" />
            <Input name="source" placeholder="Source" />
            <Input name="value" type="number" min="0" step="0.01" placeholder="Value" />
            <Input name="probability" type="number" min="0" max="100" defaultValue="0" />
            <label htmlFor="expected_close_date" className="text-[11px] text-secondary">
              Expected close
              <Input id="expected_close_date" name="expected_close_date" type="date" className="mt-1" />
            </label>
            <textarea
              name="description"
              rows={3}
              placeholder="Description"
              className="text-xs rounded-md border border-subtle bg-surface-1 p-2 text-primary"
            />
            <Button type="submit" loading={creating}>
              Create opportunity
            </Button>
            {formError ? <p className="text-xs text-danger-primary">{formError}</p> : null}
          </form>
        </SummonCard>
      </div>
    </SummonScreen>
  );
}
