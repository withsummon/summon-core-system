/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useState } from "react";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import Link from "next/link";
import { useOutletContext } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { FunctionReturnType } from "convex/server";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import { field, mutationMessage } from "@/components/convex-core/commercial/forms";
import { CheckCircle2, Copy, PlugZap } from "lucide-react";
import { Button } from "@plane/propel/button";
import { AlertModalCore, Input } from "@plane/ui";
import { SummonField } from "@/components/summon/forms";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonCard, SummonScreen } from "@/components/summon/screen";

type Settings = FunctionReturnType<typeof api.settings.index.metadata>;
const weekdays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const satisfies Settings["workweek"];

export default function SummonSettingsPage() {
  const session = useOutletContext<WorkspaceSession>();
  const commands = useStickiesCommands();
  const settings = useQuery(
    api.settings.index.metadata,
    session.workspace.membershipRole === "guest" ? "skip" : { workspaceId: session.workspace._id }
  );
  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
      {session.workspace.membershipRole === "guest" ? (
        <SummonRequestState permissionError />
      ) : settings ? (
        <SettingsContent key={session.workspace._id} settings={settings} session={session} />
      ) : (
        <SummonRequestState loading />
      )}
    </PreservedWorkspaceShell>
  );
}

function SettingsContent({ settings, session }: { settings: Settings; session: WorkspaceSession }) {
  const [data, setData] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [reloading, setReloading] = useState(false);
  const discard = useCallback(() => setDirty(false), []);
  const release = useReloadConfirmations(
    dirty || saving,
    "This workspace settings form has unsaved changes.",
    discard,
    saving
  );
  const update = useMutation(api.settings.index.update);
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setSaved(false);
    setFormError("");
    try {
      const revision = data.revision;
      const fields = {
        name: field(form, "name"),
        slug: data.slug,
        organizationSize: field(form, "organization_size") || null,
        industry: field(form, "industry"),
        timezone: field(form, "timezone"),
        description: field(form, "description"),
        currency: field(form, "currency").toUpperCase(),
        workweek: weekdays.filter((day) => form.getAll("workweek").includes(day)),
      };
      const result = await update({ workspaceId: session.workspace._id, ...fields, expectedRevision: revision });
      setData({ ...data, ...fields, revision: result.revision });
      setSaved(true);
      setDirty(false);
      release();
    } catch (error) {
      setFormError(mutationMessage(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <SummonScreen title="Workspace Settings" description="Workspace identity and Summon business settings.">
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <SummonCard>
          <h2 className="text-sm font-semibold text-primary">Company profile</h2>
          <form
            key={data.revision}
            onSubmit={save}
            onChange={() => {
              setSaved(false);
              setDirty(true);
            }}
            className="mt-4"
          >
            <fieldset disabled={saving || !settings.canManage} className="grid gap-4 sm:grid-cols-2">
              <SummonField label="Workspace name">
                <Input name="name" defaultValue={data.name} required maxLength={80} />
              </SummonField>
              <SummonField label="Workspace slug">
                <Input value={data.slug} readOnly disabled />
              </SummonField>
              <SummonField label="Industry">
                <Input name="industry" defaultValue={data.industry} maxLength={120} />
              </SummonField>
              <SummonField label="Organization size">
                <Input name="organization_size" defaultValue={data.organizationSize ?? ""} maxLength={20} />
              </SummonField>
              <SummonField label="Timezone">
                <Input name="timezone" defaultValue={data.timezone} required />
              </SummonField>
              <SummonField label="Currency">
                <Input
                  name="currency"
                  minLength={3}
                  maxLength={3}
                  pattern="[A-Za-z]{3}"
                  required
                  defaultValue={data.currency}
                />
              </SummonField>
              <div className="sm:col-span-2">
                <SummonField label="Description">
                  <textarea
                    name="description"
                    rows={4}
                    defaultValue={data.description}
                    maxLength={100000}
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
                <Button size="xl" type="submit" loading={saving}>
                  Save settings
                </Button>
                {saved ? (
                  <span className="text-xs flex items-center gap-1 text-success-primary">
                    <CheckCircle2 className="size-3.5" /> Saved
                  </span>
                ) : null}
                {formError ? (
                  <p role="alert" className="text-xs text-danger-primary">
                    {formError}
                  </p>
                ) : null}
              </div>
            </fieldset>
            {data.revision !== settings.revision && (
              <div className="text-xs mt-3 flex flex-wrap items-center gap-2 text-warning-primary" role="status">
                Settings changed in another session.{" "}
                <Button
                  variant="secondary"
                  disabled={saving}
                  onClick={() => {
                    if (dirty) setReloading(true);
                    else {
                      setData(settings);
                      setSaved(false);
                      setFormError("");
                    }
                  }}
                >
                  Reload latest settings
                </Button>
              </div>
            )}
            {!settings.canManage && (
              <p className="text-xs mt-3 text-secondary">Only workspace administrators can change settings.</p>
            )}
          </form>
          <AlertModalCore
            isOpen={reloading}
            handleClose={() => setReloading(false)}
            isSubmitting={saving}
            handleSubmit={() => {
              release(() => {
                setData(settings);
                setSaved(false);
                setFormError("");
                setDirty(false);
                setReloading(false);
              });
            }}
            variant="primary"
            title="Reload latest settings?"
            content="This replaces your unsaved settings with the latest saved version."
            primaryButtonText={{ default: "Reload", loading: "Waiting…" }}
            secondaryButtonText="Keep editing"
          />
        </SummonCard>

        {settings.canManage ? (
          <WorkspaceIntegrations workspace={session.workspace} />
        ) : (
          <p className="text-xs text-secondary">Only workspace administrators can view integration settings.</p>
        )}
      </div>
    </SummonScreen>
  );
}

function WorkspaceIntegrations({ workspace }: { workspace: WorkspaceSession["workspace"] }) {
  const workspaceSlug = workspace.slug;
  const [checking, setChecking] = useState(false);
  const [integrationError, setIntegrationError] = useState("");
  const [mcpStatus, setMcpStatus] = useState<FunctionReturnType<typeof api.settings.index.checkMcp> | null>(null);
  const integrations = useQuery(api.settings.index.integrationStatus, { workspaceId: workspace._id });
  const checkMcp = useAction(api.settings.index.checkMcp);
  const checkStatus = async () => {
    setChecking(true);
    setIntegrationError("");
    try {
      setMcpStatus(await checkMcp({ workspaceId: workspace._id }));
    } catch (error) {
      setIntegrationError(mutationMessage(error));
    } finally {
      setChecking(false);
    }
  };
  if (integrations === undefined) return <SummonRequestState loading />;
  const mcpOrigin = integrations.mcpOrigin;
  return (
    <div className="space-y-4">
      <SummonCard>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <PlugZap className="size-4 text-accent-primary" />
            <h2 className="text-sm font-semibold text-primary">Plane MCP</h2>
          </div>
          <span
            className={`rounded-full px-2 py-1 text-[10px] font-medium ${mcpStatus?.reached && mcpStatus.status !== null && mcpStatus.status < 400 ? "bg-success-subtle text-success-primary" : "bg-warning-subtle text-warning-primary"}`}
          >
            {checking
              ? "Checking…"
              : mcpStatus?.reached
                ? `HTTP ${mcpStatus.status}`
                : mcpOrigin
                  ? "Not checked"
                  : "Not configured"}
          </span>
        </div>
        <p className="text-xs mt-3 leading-relaxed text-secondary">
          Connect Summon to a remote Plane MCP service using a credential in the vault. HTTP reachability does not
          verify authentication or tool access.
        </p>
        <div className="mt-3 rounded-xl bg-layer-1 p-3">
          <code className="text-[11px] break-all text-primary">{mcpOrigin ?? "No remote MCP service configured"}</code>
          <button
            type="button"
            disabled={!mcpOrigin}
            onClick={async () => {
              if (!mcpOrigin) return;
              try {
                await navigator.clipboard.writeText(mcpOrigin);
                setIntegrationError("");
              } catch {
                setIntegrationError("Could not copy the endpoint. Select and copy it manually.");
              }
            }}
            className="mt-2 flex items-center gap-1 text-[11px] font-medium text-accent-primary"
          >
            <Copy className="size-3" /> Copy service origin
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
            href="/settings/profile/api-tokens/"
            className="text-xs rounded-md bg-accent-primary px-3 py-2 font-medium text-white"
          >
            Manage API tokens
          </Link>
          <Button
            size="lg"
            variant="secondary"
            loading={checking}
            disabled={!mcpOrigin}
            onClick={() => void checkStatus()}
          >
            Check status
          </Button>
        </div>
        {integrationError && (
          <p role="alert" className="text-xs mt-3 text-danger-primary">
            {integrationError}
          </p>
        )}
        {mcpStatus && !mcpStatus.reached && (
          <p role="status" className="text-xs mt-3 text-warning-primary">
            Remote MCP could not be reached.
          </p>
        )}
      </SummonCard>
      <SummonCard>
        <h2 className="text-sm font-semibold text-primary">Assistant identity</h2>
        <p className="text-xs mt-2 leading-relaxed text-secondary">
          Store a Plane PAT as provider <strong>Plane MCP PAT</strong> in Credential Vault, then select it in a Summon
          Assistant conversation. Decryption and tool calls remain server-side.
        </p>
        <p className="text-xs mt-2 text-secondary">
          AI provider: {integrations.ai ? `${integrations.ai.provider} · ${integrations.ai.model}` : "Not configured"}
        </p>
        <Link
          href={`/${workspaceSlug}/summon/credentials`}
          className="text-xs mt-3 inline-block font-medium text-accent-primary"
        >
          Open Credential Vault →
        </Link>
      </SummonCard>
    </div>
  );
}
