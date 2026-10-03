/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Controller } from "react-hook-form";
import Link from "next/link";
import { Building2, Plus, Search } from "lucide-react";
import { Input } from "@plane/ui";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonCard, SummonMetric, SummonScreen } from "@/components/summon/screen";
import { ClientForm } from "./client-form";
import { DatePicker } from "@plane/propel/date-picker";
import { Button } from "@plane/propel/button";

export function Clients({ workspace }: { workspace: FunctionReturnType<typeof api.workspaces.index.list>[number] }) {
  const workspaceSlug = workspace.slug;
  const [query, setQuery] = useState("");
  const context = useQuery(api.commercial.clients.get, { workspaceId: workspace._id, clientId: null });
  const {
    results: data,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.commercial.clients.list,
    { workspaceId: workspace._id, search: query },
    { initialNumItems: 20 }
  );
  const {
    results: counts,
    status: countStatus,
    loadMore: loadMoreCounts,
  } = usePaginatedQuery(api.commercial.clients.counts, { workspaceId: workspace._id }, { initialNumItems: 100 });
  useEffect(() => {
    if (countStatus === "CanLoadMore") loadMoreCounts(100);
  }, [countStatus, loadMoreCounts]);
  const ready = countStatus === "Exhausted";
  const total = counts.reduce((sum, row) => sum + row.total, 0);
  const active = counts.reduce((sum, row) => sum + row.active, 0);

  return (
    <SummonScreen
      title="Clients"
      description="Commercial accounts backed by the current workspace."
      actions={
        <div className="relative block w-72 max-w-full">
          <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-tertiary" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search clients"
            className="pl-8"
          />
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <SummonMetric label="Clients" value={ready ? total : "—"} detail="Authorized workspace records" />
        <SummonMetric label="Active" value={ready ? active : "—"} detail="Persisted client status" />
        <SummonMetric label="Retention" value="—" detail="No metric source configured" />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          {status === "LoadingFirstPage" ? (
            <SummonRequestState loading />
          ) : status === "Exhausted" && data.length === 0 ? (
            <SummonRequestState empty emptyMessage="No clients match this workspace or search." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.map((client) => (
                <Link
                  key={client._id}
                  href={`/${workspaceSlug}/summon/clients/${client._id}`}
                  className="hover:border-accent-primary/50 rounded-2xl border border-subtle bg-surface-1 p-4 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-primary/10 text-accent-primary">
                      <Building2 className="size-4.5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-sm truncate font-semibold text-primary">{client.name}</h2>
                      <p className="mt-0.5 truncate text-[11px] text-secondary">
                        {client.companyName || client.industry || "Company details not set"}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs mt-4 line-clamp-2 min-h-8 text-secondary">
                    {client.notes || "No relationship notes yet."}
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-subtle pt-3 text-[11px]">
                    <span className="text-secondary capitalize">{client.status}</span>
                    <span className="font-medium text-accent-primary">View client →</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {status === "CanLoadMore" && (
            <Button className="mt-3" variant="secondary" onClick={() => loadMore(20)}>
              Load more clients
            </Button>
          )}
          {status === "LoadingMore" && (
            <p role="status" className="mt-3 text-12 text-secondary">
              Loading clients…
            </p>
          )}
        </div>

        {context?.canWrite && (
          <SummonCard>
            <div className="flex items-center gap-2">
              <Plus className="size-4 text-accent-primary" />
              <h2 className="text-sm font-semibold text-primary">Add client</h2>
            </div>
            <ClientForm workspaceId={workspace._id} context={context} className="mt-4 grid gap-3">
              {({ register, control, formState: { isSubmitting } }) => (
                <>
                  <Input
                    {...register("name")}
                    required
                    maxLength={255}
                    aria-label="Client name"
                    placeholder="Client name"
                  />
                  <Input
                    {...register("companyName")}
                    maxLength={255}
                    aria-label="Legal company name"
                    placeholder="Legal company name"
                  />
                  <Input {...register("industry")} maxLength={120} aria-label="Industry" placeholder="Industry" />
                  <Input
                    {...register("website")}
                    type="url"
                    maxLength={200}
                    aria-label="Website"
                    placeholder="https://example.com"
                  />
                  <Input
                    {...register("headOffice")}
                    maxLength={255}
                    aria-label="Head office"
                    placeholder="Head office"
                  />
                  <label htmlFor="relationshipStartedAt" className="text-[11px] text-secondary">
                    Relationship started
                    <Controller
                      name="relationshipStartedAt"
                      control={control}
                      render={({ field }) => (
                        <DatePicker
                          id="relationshipStartedAt"
                          name={field.name}
                          value={field.value ?? ""}
                          onValueChange={(value) => field.onChange(value || null)}
                          disabled={isSubmitting}
                          className="mt-1"
                        />
                      )}
                    />
                  </label>
                  <textarea
                    {...register("notes")}
                    rows={3}
                    maxLength={100000}
                    aria-label="Relationship notes"
                    placeholder="Relationship notes"
                    className="text-xs rounded-md border border-subtle bg-surface-1 p-2 text-primary"
                  />
                </>
              )}
            </ClientForm>
          </SummonCard>
        )}
      </div>
    </SummonScreen>
  );
}
