/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Building2, Plus, Search } from "lucide-react";
import { Button, Input } from "@plane/ui";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonCard, SummonMetric, SummonScreen, summonErrorMessage } from "@/components/summon/screen";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";

export default function SummonClientsPage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const { data, error, isLoading, mutate } = useSWR(["summon-clients", workspaceSlug], () =>
    summonService.listClients(workspaceSlug)
  );
  const clients = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (data ?? []).filter((client) =>
      [client.name, client.company_name, client.industry].some((value) => value.toLowerCase().includes(normalized))
    );
  }, [data, query]);

  const createClient = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setCreating(true);
    setFormError("");
    try {
      await summonService.createClient(workspaceSlug, {
        name: form.get("name"),
        company_name: form.get("company_name"),
        industry: form.get("industry"),
        website: form.get("website"),
        head_office: form.get("head_office"),
        relationship_started_at: form.get("relationship_started_at") || null,
        notes: form.get("notes"),
        status: "lead",
      });
      event.currentTarget.reset();
      await mutate();
    } catch (requestError) {
      setFormError(summonErrorMessage(requestError));
    } finally {
      setCreating(false);
    }
  };

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
        <SummonMetric label="Clients" value={data?.length ?? 0} detail="Authorized workspace records" />
        <SummonMetric
          label="Active"
          value={data?.filter((client) => client.status === "active").length ?? 0}
          detail="Persisted client status"
        />
        <SummonMetric label="Retention" value="—" detail="No metric source configured" />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          {!data ? (
            <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />
          ) : clients.length === 0 ? (
            <SummonRequestState empty emptyMessage="No clients match this workspace or search." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {clients.map((client) => (
                <Link
                  key={client.id}
                  href={`/${workspaceSlug}/summon/clients/${client.id}`}
                  className="hover:border-accent-primary/50 rounded-2xl border border-subtle bg-surface-1 p-4 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-primary/10 text-accent-primary">
                      <Building2 className="size-4.5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-sm truncate font-semibold text-primary">{client.name}</h2>
                      <p className="mt-0.5 truncate text-[11px] text-secondary">
                        {client.company_name || client.industry || "Company details not set"}
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
        </div>

        <SummonCard>
          <div className="flex items-center gap-2">
            <Plus className="size-4 text-accent-primary" />
            <h2 className="text-sm font-semibold text-primary">Add client</h2>
          </div>
          <form onSubmit={createClient} className="mt-4 grid gap-3">
            <Input name="name" required placeholder="Client name" />
            <Input name="company_name" placeholder="Legal company name" />
            <Input name="industry" placeholder="Industry" />
            <Input name="website" type="url" placeholder="https://example.com" />
            <Input name="head_office" placeholder="Head office" />
            <label htmlFor="relationship_started_at" className="text-[11px] text-secondary">
              Relationship started
              <Input id="relationship_started_at" name="relationship_started_at" type="date" className="mt-1" />
            </label>
            <textarea
              name="notes"
              rows={3}
              placeholder="Relationship notes"
              className="text-xs rounded-md border border-subtle bg-surface-1 p-2 text-primary"
            />
            <Button type="submit" loading={creating}>
              Create client
            </Button>
            {formError ? <p className="text-xs text-danger-primary">{formError}</p> : null}
          </form>
        </SummonCard>
      </div>
    </SummonScreen>
  );
}
