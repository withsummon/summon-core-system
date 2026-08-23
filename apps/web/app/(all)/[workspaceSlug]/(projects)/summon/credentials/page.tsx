/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import useSWR from "swr";
import { KeyRound, Plus } from "lucide-react";
import { Button, Input } from "@plane/ui";
import { SummonField, SummonSelect } from "@/components/summon/forms";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonCard, SummonMetric, SummonScreen, summonErrorMessage } from "@/components/summon/screen";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";

export default function SummonCredentialsPage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const { data, error, isLoading, mutate } = useSWR(["summon-credentials", workspaceSlug], () =>
    summonService.listCredentials(workspaceSlug)
  );

  const createCredential = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setCreating(true);
    setFormError("");
    try {
      await summonService.createCredential(workspaceSlug, {
        name: form.get("name"),
        provider: form.get("provider"),
        account_identifier: form.get("account_identifier"),
        secret: form.get("secret"),
        metadata: {},
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
      title="Credential Vault"
      description="Encrypted credentials scoped to their owner and explicit grants. Secret values are never returned in list responses."
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <SummonMetric label="Credentials" value={data?.length ?? 0} detail="Accessible to you" />
        <SummonMetric
          label="Active"
          value={data?.filter((item) => item.status === "active").length ?? 0}
          detail="Not revoked"
        />
        <SummonMetric
          label="Plane MCP PAT"
          value={data?.filter((item) => item.provider === "plane_mcp").length ?? 0}
          detail="Available to Assistant"
        />
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        {!data ? (
          <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />
        ) : data.length === 0 ? (
          <SummonRequestState empty emptyMessage="No credentials are available to you." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.map((credential) => (
              <SummonCard key={credential.id}>
                <div className="flex items-start gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-accent-primary/10 text-accent-primary">
                    <KeyRound className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-sm truncate font-semibold text-primary">{credential.name}</h2>
                    <p className="mt-1 truncate text-[11px] text-secondary">
                      {credential.provider} · {credential.account_identifier || "No account identifier"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-subtle pt-3 text-[11px]">
                  <span className="text-secondary capitalize">{credential.status}</span>
                  <code className="text-tertiary">{credential.secret}</code>
                </div>
              </SummonCard>
            ))}
          </div>
        )}
        <SummonCard>
          <div className="flex items-center gap-2">
            <Plus className="size-4 text-accent-primary" />
            <h2 className="text-sm font-semibold text-primary">Store credential</h2>
          </div>
          <form onSubmit={createCredential} className="mt-4 grid gap-3">
            <Input name="name" required placeholder="Credential name" />
            <SummonField label="Provider">
              <SummonSelect name="provider" defaultValue="plane_mcp">
                <option value="plane_mcp">Plane MCP PAT</option>
                <option value="github">GitHub</option>
                <option value="figma">Figma</option>
                <option value="other">Other</option>
              </SummonSelect>
            </SummonField>
            <Input name="account_identifier" placeholder="Account identifier" />
            <Input name="secret" type="password" required autoComplete="new-password" placeholder="Secret or PAT" />
            <p className="text-[10px] leading-relaxed text-tertiary">
              The secret is encrypted server-side and is not displayed again here.
            </p>
            <Button type="submit" loading={creating}>
              Save credential
            </Button>
            {formError ? <p className="text-xs text-danger-primary">{formError}</p> : null}
          </form>
        </SummonCard>
      </div>
    </SummonScreen>
  );
}
