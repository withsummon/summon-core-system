/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { CheckCircle2, Copy, PlugZap } from "lucide-react";
import { Button, Input } from "@plane/ui";
import { SummonField } from "@/components/summon/forms";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonCard, SummonScreen, summonErrorMessage } from "@/components/summon/screen";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";

const weekdays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export default function SummonSettingsPage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [saved, setSaved] = useState(false);
  const { data, error, isLoading, mutate } = useSWR(["summon-workspace-settings", workspaceSlug], () =>
    summonService.getWorkspaceSettings(workspaceSlug)
  );
  const { data: mcpStatus, mutate: reloadMCP } = useSWR(["summon-mcp-status", workspaceSlug], () =>
    summonService.getMCPStatus(workspaceSlug)
  );
  const { data: aiStatus } = useSWR(["summon-ai-status", workspaceSlug], () =>
    summonService.getAIStatus(workspaceSlug)
  );

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setSaved(false);
    setFormError("");
    try {
      await summonService.updateWorkspaceSettings(workspaceSlug, {
        name: String(form.get("name") || ""),
        organization_size: String(form.get("organization_size") || ""),
        timezone: String(form.get("timezone") || "UTC"),
        industry: String(form.get("industry") || ""),
        description: String(form.get("description") || ""),
        currency: String(form.get("currency") || "IDR").toUpperCase(),
        workweek: form.getAll("workweek") as (typeof weekdays)[number][],
      });
      await mutate();
      setSaved(true);
    } catch (requestError) {
      setFormError(summonErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SummonScreen
      title="Workspace Settings"
      description="Plane-owned workspace identity with Summon-specific business settings."
    >
      {!data ? (
        <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <SummonCard>
            <h2 className="text-sm font-semibold text-primary">Company profile</h2>
            <form key={`${data.slug}-${data.name}`} onSubmit={save} className="mt-4 grid gap-4 sm:grid-cols-2">
              <SummonField label="Workspace name">
                <Input name="name" defaultValue={data.name} required />
              </SummonField>
              <SummonField label="Workspace slug">
                <Input value={data.slug} readOnly disabled />
              </SummonField>
              <SummonField label="Industry">
                <Input name="industry" defaultValue={data.industry} />
              </SummonField>
              <SummonField label="Organization size">
                <Input name="organization_size" defaultValue={data.organization_size || ""} />
              </SummonField>
              <SummonField label="Timezone">
                <Input name="timezone" defaultValue={data.timezone} />
              </SummonField>
              <SummonField label="Currency">
                <Input name="currency" minLength={3} maxLength={3} defaultValue={data.currency} />
              </SummonField>
              <div className="sm:col-span-2">
                <SummonField label="Description">
                  <textarea
                    name="description"
                    rows={4}
                    defaultValue={data.description}
                    className="text-xs w-full rounded-md border border-subtle bg-surface-1 p-2 text-primary"
                  />
                </SummonField>
              </div>
              <fieldset className="sm:col-span-2">
                <legend className="text-xs mb-2 font-medium text-secondary">Workweek</legend>
                <div className="flex flex-wrap gap-2">
                  {weekdays.map((day) => (
                    <label
                      key={day}
                      className="text-xs flex items-center gap-1.5 rounded-lg border border-subtle px-2.5 py-1.5 text-primary capitalize"
                    >
                      <input type="checkbox" name="workweek" value={day} defaultChecked={data.workweek.includes(day)} />
                      {day}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="flex items-center gap-3 sm:col-span-2">
                <Button type="submit" loading={saving}>
                  Save settings
                </Button>
                {saved ? (
                  <span className="text-xs flex items-center gap-1 text-success-primary">
                    <CheckCircle2 className="size-3.5" /> Saved
                  </span>
                ) : null}
                {formError ? <p className="text-xs text-danger-primary">{formError}</p> : null}
              </div>
            </form>
          </SummonCard>

          <div className="space-y-4">
            <SummonCard>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <PlugZap className="size-4 text-accent-primary" />
                  <h2 className="text-sm font-semibold text-primary">Plane MCP</h2>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-medium ${mcpStatus?.reachable ? "bg-success-subtle text-success-primary" : "bg-warning-subtle text-warning-primary"}`}
                >
                  {mcpStatus?.reachable ? "Service reachable" : "Unavailable"}
                </span>
              </div>
              <p className="text-xs mt-3 leading-relaxed text-secondary">
                Connect external MCP clients with a Plane personal access token. Tokens are shown only once by Plane and
                must not be pasted into logs.
              </p>
              <div className="mt-3 rounded-xl bg-layer-1 p-3">
                <code className="text-[11px] break-all text-primary">
                  https://&lt;your-domain&gt;/mcp/http/api-key/mcp
                </code>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText("/mcp/http/api-key/mcp")}
                  className="mt-2 flex items-center gap-1 text-[11px] font-medium text-accent-primary"
                >
                  <Copy className="size-3" /> Copy path
                </button>
              </div>
              <dl className="text-xs mt-3 space-y-2">
                <div>
                  <dt className="text-tertiary">Authorization</dt>
                  <dd className="mt-0.5 text-primary">Bearer &lt;PAT&gt;</dd>
                </div>
                <div>
                  <dt className="text-tertiary">Workspace header</dt>
                  <dd className="mt-0.5 text-primary">X-Workspace-slug: {workspaceSlug}</dd>
                </div>
              </dl>
              <div className="mt-4 flex gap-2">
                <Link
                  href={`/${workspaceSlug}/settings/api-tokens`}
                  className="text-xs rounded-md bg-accent-primary px-3 py-2 font-medium text-white"
                >
                  Manage API tokens
                </Link>
                <Button size="sm" variant="neutral-primary" onClick={() => void reloadMCP()}>
                  Check status
                </Button>
              </div>
            </SummonCard>
            <SummonCard>
              <h2 className="text-sm font-semibold text-primary">Assistant identity</h2>
              <p className="text-xs mt-2 leading-relaxed text-secondary">
                Store a Plane PAT as provider <strong>Plane MCP PAT</strong> in Credential Vault, then select it in a
                Summon Assistant conversation. Decryption and tool calls remain server-side.
              </p>
              <p className="text-xs mt-2 text-secondary">
                AI provider: {aiStatus?.configured ? `${aiStatus.provider} · ${aiStatus.model}` : "Not configured"}
              </p>
              <Link
                href={`/${workspaceSlug}/summon/credentials`}
                className="text-xs mt-3 inline-block font-medium text-accent-primary"
              >
                Open Credential Vault →
              </Link>
            </SummonCard>
          </div>
        </div>
      )}
    </SummonScreen>
  );
}
