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
import { SummonScreen, summonErrorMessage } from "@/components/summon/screen";
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
      <form
        onSubmit={submit}
        className="grid gap-3 rounded-lg border border-subtle bg-surface-1 p-4 md:grid-cols-4 md:items-end"
      >
        <SummonField label="Name">
          <Input required value={name} onChange={(event) => setName(event.target.value)} />
        </SummonField>
        <SummonField label="Provider">
          <Input required value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="github" />
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
        {formError ? <p className="text-xs text-danger-primary md:col-span-4">{formError}</p> : null}
      </form>
      <SummonRequestState
        loading={isLoading}
        error={error}
        empty={!isLoading && data.length === 0}
        onRetry={() => void mutate()}
      />
      <div className="grid gap-3 md:grid-cols-2">
        {data.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelected(item)}
            className="rounded-lg border border-subtle bg-surface-1 p-4 text-left hover:bg-layer-1"
          >
            <p className="text-sm font-medium text-primary">{item.name}</p>
            <p className="text-xs mt-1 text-secondary">
              {item.provider} · {item.account_identifier || "No account label"}
            </p>
            <p className="font-mono text-xs mt-3 text-secondary">{item.secret}</p>
          </button>
        ))}
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
