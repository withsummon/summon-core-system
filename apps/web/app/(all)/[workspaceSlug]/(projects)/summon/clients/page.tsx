/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import useSWR from "swr";
import { Button, Input, TextArea } from "@plane/ui";
import { SummonField } from "@/components/summon/forms";
import { SummonRequestState } from "@/components/summon/request-state";
import {
  SummonCard,
  SummonMetric,
  SummonRecordList,
  SummonScreen,
  summonErrorMessage,
} from "@/components/summon/screen";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";

export default function SummonClientsPage({ params }: Route.ComponentProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const {
    data = [],
    error,
    isLoading,
    mutate,
  } = useSWR(["summon-clients", params.workspaceSlug], () => summonService.listClients(params.workspaceSlug));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await summonService.createClient(params.workspaceSlug, { name, description });
      setName("");
      setDescription("");
      await mutate();
    } catch (requestError) {
      setFormError(summonErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SummonScreen
      title="Clients"
      description="Commercial accounts owned once by Summon and linked to Plane delivery projects."
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <SummonMetric label="Total clients" value={data.length} detail="Commercial accounts" />
        <SummonMetric
          label="Active clients"
          value={data.filter(({ status }) => status.toLowerCase() === "active").length}
          detail="Ready for delivery"
        />
        <SummonMetric
          label="Industries"
          value={new Set(data.map(({ industry }) => industry).filter(Boolean)).size}
          detail="Across the portfolio"
        />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-3">
          <SummonRequestState
            loading={isLoading}
            error={error}
            empty={!isLoading && data.length === 0}
            onRetry={() => void mutate()}
            emptyMessage="No clients yet. Add the first commercial account."
          />
          {data.length ? (
            <SummonRecordList
              records={data.map((item) => ({
                id: item.id,
                title: item.name,
                detail: [item.industry, item.description || item.website].filter(Boolean).join(" · "),
                badge: item.status,
              }))}
            />
          ) : null}
        </div>
        <SummonCard>
          <h2 className="text-sm font-semibold text-primary">Add client</h2>
          <p className="text-xs mt-1 text-secondary">Create the commercial account once.</p>
          <form onSubmit={submit} className="mt-4 grid gap-3">
            <SummonField label="Client name">
              <Input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Acme" />
            </SummonField>
            <SummonField label="Description">
              <TextArea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Commercial context"
              />
            </SummonField>
            <Button type="submit" loading={saving}>
              Add client
            </Button>
            {formError ? <p className="text-xs text-danger-primary">{formError}</p> : null}
          </form>
        </SummonCard>
      </div>
    </SummonScreen>
  );
}
