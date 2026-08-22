/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import useSWR from "swr";
import { Button, Input } from "@plane/ui";
import type { ISummonCredential } from "@plane/types";
import { CredentialDrawer } from "@/components/summon/credential-drawer";
import { SummonField } from "@/components/summon/forms";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonCard, SummonMetric, SummonScreen, summonErrorMessage } from "@/components/summon/screen";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";

export default function SummonCredentialsPage({ params }: Route.ComponentProps) {
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("");
  const [account, setAccount] = useState("");
  const [secret, setSecret] = useState("");
  const [selected, setSelected] = useState<ISummonCredential>();
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const {
    data = [],
    error,
    isLoading,
    mutate,
  } = useSWR(["summon-credentials", params.workspaceSlug], () => summonService.listCredentials(params.workspaceSlug));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await summonService.createCredential(params.workspaceSlug, {
        name,
        provider,
        account_identifier: account,
        secret,
      });
      setName("");
      setProvider("");
      setAccount("");
      setSecret("");
      await mutate();
    } catch (requestError) {
      setFormError(summonErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };
  return (
    <SummonScreen
      title="Credential Vault"
      description="Encrypted at rest. Reveal and rotation require your current password and are audited."
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <SummonMetric label="Total credentials" value={data.length} detail="Across accessible projects" />
        <SummonMetric
          label="Active accounts"
          value={data.filter(({ status }) => status === "active").length}
          detail="Available for authorized use"
        />
        <SummonMetric
          label="Providers"
          value={new Set(data.map((item) => item.provider)).size}
          detail="Connected services"
        />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-3">
          <SummonRequestState
            loading={isLoading}
            error={error}
            empty={!isLoading && data.length === 0}
            onRetry={() => void mutate()}
          />
          {data.length ? (
            <div className="shadow-sm divide-y divide-subtle overflow-hidden rounded-xl border border-subtle bg-surface-1">
              {data.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelected(item)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-layer-1"
                >
                  <div className="min-w-0">
                    <p className="text-sm truncate font-medium text-primary">{item.name}</p>
                    <p className="text-xs mt-1 truncate text-secondary">
                      {item.provider} · {item.account_identifier || "No account label"}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="font-mono text-xs text-secondary">{item.secret}</p>
                    <span className="mt-1 inline-block rounded-full bg-layer-2 px-2 py-0.5 text-[11px] text-secondary">
                      {item.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <SummonCard>
          <h2 className="text-sm font-semibold text-primary">Add credential</h2>
          <p className="text-xs mt-1 text-secondary">Secrets remain encrypted and audited.</p>
          <form onSubmit={submit} className="mt-4 grid gap-3">
            <SummonField label="Name">
              <Input required value={name} onChange={(event) => setName(event.target.value)} />
            </SummonField>
            <SummonField label="Provider">
              <Input
                required
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
                placeholder="github"
              />
            </SummonField>
            <SummonField label="Account">
              <Input value={account} onChange={(event) => setAccount(event.target.value)} />
            </SummonField>
            <SummonField label="Secret">
              <Input
                required
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                autoComplete="new-password"
              />
            </SummonField>
            <Button type="submit" loading={saving}>
              Store encrypted credential
            </Button>
            {formError ? <p className="text-xs text-danger-primary">{formError}</p> : null}
          </form>
        </SummonCard>
      </div>
      <CredentialDrawer
        workspaceSlug={params.workspaceSlug}
        credential={selected}
        onClose={() => setSelected(undefined)}
        onChanged={() => void mutate()}
      />
    </SummonScreen>
  );
}
