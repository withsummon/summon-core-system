/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Building2, Plus } from "lucide-react";
import { Button } from "@plane/propel/button";
import { TextArea } from "@plane/propel/input";
import { Input } from "@plane/ui";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonSkeletonBlock, SummonSkeletonRows, SummonSkeletonText } from "@/components/summon/skeleton";
import { SummonField } from "@/components/summon/forms";
import { SummonDrawer } from "@/components/summon/drawer";
import { SummonMetric, SummonMetricStrip, SummonScreen, summonErrorMessage } from "@/components/summon/screen";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";
import { DatePicker } from "@plane/propel/date-picker";
import { SummonSearchField } from "@/components/summon/search-field";

export default function SummonClientsPage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
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
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
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
      formElement.reset();
      setCreateOpen(false);
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
        <>
          <SummonSearchField label="Search clients" value={query} onValueChange={setQuery} className="w-full sm:w-72" />
          <Button size="lg" onClick={() => setCreateOpen(true)}>
            <Plus />
            Add client
          </Button>
        </>
      }
    >
      <SummonMetricStrip>
        <SummonMetric label="Clients" value={data?.length} loading={!data && isLoading} />
        <SummonMetric
          label="Active"
          value={data?.filter((client) => client.status === "active").length}
          loading={!data && isLoading}
        />
      </SummonMetricStrip>

      <div>
        {!data ? (
          <SummonRequestState
            loading={isLoading}
            skeleton={<ClientCardsSkeleton />}
            error={error}
            onRetry={() => void mutate()}
          />
        ) : clients.length === 0 ? (
          <SummonRequestState
            empty
            emptyAsset={data.length ? "search" : "customer"}
            emptyTitle={data.length ? "No matching clients" : "No clients yet"}
            emptyMessage={data.length ? "Try another search." : "Add the companies you work with."}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {clients.map((client) => (
              <Link
                key={client.id}
                href={`/${workspaceSlug}/summon/clients/${client.id}`}
                className="rounded-xl border border-subtle bg-surface-1 p-4 shadow-xs transition-colors hover:border-accent-strong"
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-primary/10 text-accent-primary">
                    <Building2 className="size-4.5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-primary" title={client.name}>
                      {client.name}
                    </h2>
                    <p className="mt-0.5 truncate text-12 text-secondary">
                      {client.company_name || client.industry || "Company details not set"}
                    </p>
                  </div>
                </div>
                <p className="mt-4 line-clamp-2 min-h-8 text-xs text-secondary">
                  {client.notes || "No relationship notes yet."}
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-subtle pt-3 text-12">
                  <span className="text-secondary capitalize">{client.status}</span>
                  <span className="font-medium text-accent-primary">View client →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <SummonDrawer open={createOpen} onOpenChange={setCreateOpen} title="Add client">
        <form onSubmit={createClient} className="grid gap-3">
          <SummonField label="Client name">
            <Input name="name" required />
          </SummonField>
          <SummonField label="Legal company name">
            <Input name="company_name" />
          </SummonField>
          <div className="grid gap-3 sm:grid-cols-2">
            <SummonField label="Industry">
              <Input name="industry" />
            </SummonField>
            <SummonField label="Head office">
              <Input name="head_office" />
            </SummonField>
          </div>
          <SummonField label="Website">
            <Input name="website" type="url" placeholder="https://example.com" />
          </SummonField>
          <SummonField label="Relationship started">
            <DatePicker id="relationship_started_at" name="relationship_started_at" />
          </SummonField>
          <SummonField label="Notes">
            <TextArea name="notes" rows={3} />
          </SummonField>
          {formError ? <p className="text-12 text-danger-primary">{formError}</p> : null}
          <Button size="lg" type="submit" loading={creating} className="mt-1">
            Create client
          </Button>
        </form>
      </SummonDrawer>
    </SummonScreen>
  );
}

/** Mirrors a client card: icon tile, name and company, two lines of notes, status footer. */
function ClientCardsSkeleton() {
  return (
    <SummonSkeletonRows
      count={6}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
      label="Loading clients"
      row={(index) => (
        <div key={index} className="rounded-xl border border-subtle bg-surface-1 p-4 shadow-xs">
          <div className="flex items-start gap-3">
            <SummonSkeletonBlock className="size-9 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <SummonSkeletonText className="text-sm font-semibold" width={index % 2 ? "w-28" : "w-36"} />
              <SummonSkeletonText className="mt-0.5 text-12" width="w-24" />
            </div>
          </div>
          <div className="mt-4 min-h-8">
            <SummonSkeletonText className="text-xs" width="w-full" />
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-subtle pt-3 text-12">
            <SummonSkeletonText width="w-12" />
            <span className="font-medium text-tertiary">View client →</span>
          </div>
        </div>
      )}
    />
  );
}
