/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import useSWR from "swr";
import { Button, Input } from "@plane/ui";
import { SummonField, SummonSelect } from "@/components/summon/forms";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonRecordList, SummonScreen, summonErrorMessage } from "@/components/summon/screen";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";

export default function SummonOpportunitiesPage({ params }: Route.ComponentProps) {
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const { data, error, isLoading, mutate } = useSWR(["summon-opportunities", params.workspaceSlug], async () => {
    const [opportunities, clients] = await Promise.all([
      summonService.listOpportunities(params.workspaceSlug),
      summonService.listClients(params.workspaceSlug),
    ]);
    return { opportunities, clients };
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await summonService.createOpportunity(params.workspaceSlug, {
        title,
        client: client || null,
        value: value || null,
      });
      setTitle("");
      setValue("");
      await mutate();
    } catch (requestError) {
      setFormError(summonErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const opportunities = data?.opportunities ?? [];
  return (
    <SummonScreen
      title="Opportunities"
      description="Pipeline stages and value stay commercial; delivery execution remains a Plane Project."
    >
      <form
        onSubmit={submit}
        className="grid gap-3 rounded-lg border border-subtle bg-surface-1 p-4 md:grid-cols-4 md:items-end"
      >
        <SummonField label="Opportunity">
          <Input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Renewal" />
        </SummonField>
        <SummonField label="Client">
          <SummonSelect value={client} onChange={(event) => setClient(event.target.value)}>
            <option value="">No client</option>
            {data?.clients.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </SummonSelect>
        </SummonField>
        <SummonField label="Value">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="0.00"
          />
        </SummonField>
        <Button type="submit" loading={saving}>
          Add opportunity
        </Button>
        {formError ? <p className="text-xs text-danger-primary md:col-span-4">{formError}</p> : null}
      </form>
      <SummonRequestState
        loading={isLoading}
        error={error}
        empty={!isLoading && opportunities.length === 0}
        onRetry={() => void mutate()}
      />
      {opportunities.length ? (
        <SummonRecordList
          records={opportunities.map((item) => ({
            id: item.id,
            title: item.title,
            detail: item.value
              ? `Value ${item.value} · ${item.probability}% probability`
              : `${item.probability}% probability`,
            badge: item.stage,
          }))}
        />
      ) : null}
    </SummonScreen>
  );
}
