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
import { SummonRecordList, SummonScreen, summonErrorMessage } from "@/components/summon/screen";
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
      <form
        onSubmit={submit}
        className="grid gap-3 rounded-lg border border-subtle bg-surface-1 p-4 md:grid-cols-[1fr_2fr_auto] md:items-end"
      >
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
        {formError ? <p className="text-xs text-danger-primary md:col-span-3">{formError}</p> : null}
      </form>
      <SummonRequestState
        loading={isLoading}
        error={error}
        empty={!isLoading && data.length === 0}
        onRetry={() => void mutate()}
        emptyMessage="No clients yet. Add the first commercial account above."
      />
      {data.length ? (
        <SummonRecordList
          records={data.map((item) => ({
            id: item.id,
            title: item.name,
            detail: item.description || item.website,
            badge: item.status,
          }))}
        />
      ) : null}
    </SummonScreen>
  );
}
