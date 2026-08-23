/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Eye,
  Filter,
  Grid2X2,
  KeyRound,
  List,
  LockKeyhole,
  Pencil,
  Plus,
  Search,
  Server,
  ShieldCheck,
  Trash2,
  UserRoundPlus,
  UsersRound,
  X,
} from "lucide-react";
import { Button, Input } from "@plane/ui";
import type { ISummonCredential } from "@plane/types";
import { PageHead } from "@/components/core/page-title";
import { CredentialDrawer } from "@/components/summon/credential-drawer";
import { SummonField, SummonSelect } from "@/components/summon/forms";
import { SummonRequestState } from "@/components/summon/request-state";
import { summonErrorMessage } from "@/components/summon/screen";
import { useMember } from "@/hooks/store/use-member";
import { useUser } from "@/hooks/store/user";
import { ProjectService } from "@/services/project";
import { summonService } from "@/services/summon.service";
import { summarizeCredentials } from "../reference-view-model";
import type { Route } from "./+types/page";

const projectService = new ProjectService();
const tabs = ["Overview", "Access", "Activity Log", "Attachments", "Notes"] as const;

const textMetadata = (credential: ISummonCredential, key: string) => {
  const value = credential.metadata[key];
  return typeof value === "string" && value.trim() ? value : "Not set";
};

const credentialTags = (credential: ISummonCredential) => {
  const tags = credential.metadata.tags;
  return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string") : [];
};

const formatDate = (value?: string | null) => {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
};

const formatRelative = (value?: string | null) => {
  if (!value) return "Never";
  return formatDate(value);
};

export default function SummonCredentialsPage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  const { data: currentUser } = useUser();
  const { getUserDetails } = useMember();
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Overview");
  const [selectedId, setSelectedId] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCredential, setEditingCredential] = useState<ISummonCredential | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const { data, error, isLoading, mutate } = useSWR(["summon-credentials", workspaceSlug], () =>
    summonService.listCredentials(workspaceSlug)
  );
  const { data: projects = [] } = useSWR(["summon-credential-projects", workspaceSlug], () =>
    projectService.getProjectsLite(workspaceSlug)
  );
  const selected = data?.find((credential) => credential.id === selectedId) ?? data?.[0];
  const { data: accessData, error: accessError } = useSWR(
    selected ? ["summon-credential-detail-access", workspaceSlug, selected.id] : null,
    async () => {
      const [grants, audit] = await Promise.all([
        summonService.listCredentialGrants(workspaceSlug, selected!.id),
        summonService.listCredentialAudit(workspaceSlug, selected!.id),
      ]);
      return { grants, audit };
    },
    { shouldRetryOnError: false }
  );

  useEffect(() => setNow(new Date()), []);
  useEffect(() => {
    if (data?.length && !data.some((credential) => credential.id === selectedId)) setSelectedId(data[0].id);
  }, [data, selectedId]);

  const projectNames = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (data ?? []).filter((credential) => {
      if (projectFilter !== "all" && credential.project !== projectFilter) return false;
      const projectName = credential.project ? projectNames.get(credential.project) : "";
      return [credential.name, credential.provider, credential.account_identifier, projectName]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized));
    });
  }, [data, projectFilter, projectNames, query]);
  const metrics = useMemo(
    () => summarizeCredentials(data ?? [], currentUser?.id ?? "", now ?? new Date("1970-01-01T00:00:00Z")),
    [currentUser?.id, data, now]
  );
  const lastUsed = accessData?.audit.find((item) => item.action === "use")?.created_at;
  const selectedOwner = selected?.owner ? getUserDetails(selected.owner) : undefined;

  const openCreate = () => {
    setEditingCredential(null);
    setFormError("");
    setFormOpen(true);
  };
  const openEdit = () => {
    if (!selected) return;
    setEditingCredential(selected);
    setFormError("");
    setFormOpen(true);
  };
  const saveCredential = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const metadata = {
      environment: form.get("environment") || "",
      description: form.get("description") || "",
      host: form.get("host") || "",
      port: form.get("port") || "",
      protocol: form.get("protocol") || "",
      expires_at: form.get("expires_at") || "",
      tags: String(form.get("tags") || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      risk: form.get("risk") || "",
    };
    const payload = {
      name: form.get("name"),
      provider: form.get("provider"),
      account_identifier: form.get("account_identifier"),
      project: form.get("project") || null,
      metadata,
    };
    setSaving(true);
    setFormError("");
    try {
      const saved = editingCredential
        ? await summonService.updateCredential(workspaceSlug, editingCredential.id, payload)
        : await summonService.createCredential(workspaceSlug, { ...payload, secret: form.get("secret") });
      await mutate();
      setSelectedId(saved.id);
      setFormOpen(false);
    } catch (requestError) {
      setFormError(summonErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mx-auto min-h-full w-full max-w-[1600px] overflow-hidden p-4 lg:p-5">
      <PageHead title="Credential Vault · Summon Core" />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-primary">Credential Vault</h1>
            <ShieldCheck className="size-4 text-secondary" />
          </div>
          <p className="text-xs mt-1 text-secondary">
            Securely store and manage accounts, API keys, and access credentials.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="relative w-80 max-w-full">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tertiary" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search credentials, projects, accounts..."
              className="pl-9"
            />
          </div>
          <Button variant="neutral-primary" size="sm">
            <Filter className="mr-1.5 size-3.5" /> Filter
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 size-3.5" /> Add Credential <ChevronDown className="ml-2 size-3.5" />
          </Button>
        </div>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Metric
          icon={LockKeyhole}
          tone="blue"
          label="Total Credentials"
          value={metrics.total}
          detail="Accessible to you"
        />
        <Metric icon={KeyRound} tone="green" label="Active Accounts" value={metrics.active} detail="Not revoked" />
        <Metric
          icon={UsersRound}
          tone="orange"
          label="Shared With Me"
          value={metrics.sharedWithMe}
          detail="Owned by another member"
        />
        <Metric
          icon={ShieldCheck}
          tone="purple"
          label="Expiring Soon"
          value={now ? metrics.expiringSoon : "—"}
          detail="Within 30 days"
        />
        <Metric
          icon={AlertTriangle}
          tone="red"
          label="Risky Credentials"
          value={metrics.risky}
          detail="Marked high or critical"
        />
      </div>

      <div className="mt-5 grid min-h-[720px] overflow-hidden rounded-2xl border border-subtle bg-surface-1 xl:grid-cols-[minmax(0,1.08fr)_minmax(30rem,0.92fr)]">
        <div className="min-w-0 border-b border-subtle xl:border-r xl:border-b-0">
          <div className="flex items-center gap-7 overflow-x-auto border-b border-subtle px-4 pt-4">
            {["All Credentials", "By Project", "By Type", "Shared With Me", "Recently Accessed"].map((tab, index) => (
              <button
                key={tab}
                type="button"
                className={`text-xs border-b-2 px-1 pb-3 font-medium whitespace-nowrap ${index === 0 ? "border-accent-primary text-accent-primary" : "border-transparent text-secondary"}`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <SummonSelect
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
              className="w-40"
            >
              <option value="all">All Projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </SummonSelect>
            <div className="flex items-center gap-2 text-[11px] text-secondary">
              <span>{filtered.length} credentials</span>
              <button
                type="button"
                className="border-accent-primary grid size-8 place-items-center rounded-lg border bg-accent-subtle text-accent-primary"
                aria-label="List view"
              >
                <List className="size-4" />
              </button>
              <button
                type="button"
                className="grid size-8 place-items-center rounded-lg border border-subtle text-secondary"
                aria-label="Grid view"
              >
                <Grid2X2 className="size-4" />
              </button>
            </div>
          </div>
          {!data ? (
            <div className="p-4">
              <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4">
              <SummonRequestState empty emptyMessage="No credentials match this filter." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-xs w-full min-w-[680px] text-left">
                <thead className="border-y border-subtle bg-layer-1/60 text-[10px] text-tertiary">
                  <tr>
                    <th className="px-4 py-3">Credential Name</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3">Project</th>
                    <th className="px-3 py-3">Environment</th>
                    <th className="px-3 py-3">Last Used</th>
                    <th className="px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {filtered.map((credential) => (
                    <tr
                      key={credential.id}
                      className={selected?.id === credential.id ? "bg-accent-subtle/50" : "hover:bg-layer-1"}
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedId(credential.id)}
                          className="flex w-full items-center gap-3 text-left"
                        >
                          <span className="grid size-8 flex-none place-items-center rounded-lg bg-accent-subtle text-accent-primary">
                            <Server className="size-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-primary">{credential.name}</span>
                            <span className="mt-0.5 block truncate text-[10px] text-secondary">
                              {credential.account_identifier || "No account identifier"}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <Badge>{credential.provider.replaceAll("_", " ")}</Badge>
                      </td>
                      <td className="px-3 py-3 text-secondary">
                        {credential.project ? projectNames.get(credential.project) || "Linked project" : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone="green">{textMetadata(credential, "environment")}</Badge>
                      </td>
                      <td className="px-3 py-3 text-secondary">{formatRelative(credential.updated_at)}</td>
                      <td className="px-3 py-3">
                        <Status value={credential.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-subtle px-4 py-4 text-[11px] text-secondary">
            <span>
              Showing {filtered.length ? `1 to ${filtered.length}` : "0"} of {filtered.length} credentials
            </span>
            <div className="flex items-center gap-1">
              <button type="button" className="grid size-7 place-items-center rounded-md border border-subtle">
                1
              </button>
              <span className="ml-3">Rows per page: 10</span>
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-center justify-between border-b border-subtle px-5 py-4">
            <h2 className="text-sm font-semibold text-primary">Credential Details</h2>
            <button type="button" aria-label="Close details" className="text-secondary">
              <X className="size-4" />
            </button>
          </div>
          {!selected ? (
            <div className="p-5">
              <SummonRequestState empty emptyMessage="Select a credential to inspect." />
            </div>
          ) : (
            <>
              <div className="flex items-start gap-4 px-5 py-5">
                <span className="grid size-14 flex-none place-items-center rounded-xl bg-accent-subtle text-accent-primary">
                  <Server className="size-6" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg truncate font-semibold text-primary">{selected.name}</h3>
                    <Status value={selected.status} />
                  </div>
                  <p className="text-xs mt-1 text-secondary capitalize">
                    {selected.provider.replaceAll("_", " ")} · {textMetadata(selected, "environment")}
                  </p>
                  <p className="mt-2 text-[11px] text-tertiary">
                    Last used {formatRelative(lastUsed)} · Created {formatDate(selected.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex gap-6 overflow-x-auto border-b border-subtle px-5">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`text-xs border-b-2 py-3 font-medium whitespace-nowrap ${activeTab === tab ? "border-accent-primary text-accent-primary" : "border-transparent text-secondary"}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div className="p-5">
                {activeTab === "Overview" ? (
                  <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
                    <div className="rounded-xl border border-subtle p-4">
                      <dl className="text-xs grid gap-4">
                        <Detail label="Username" value={selected.account_identifier || "Not set"} copy />
                        <Detail
                          label="Password"
                          value={selected.secret}
                          action={
                            <button type="button" onClick={() => setManageOpen(true)} className="text-accent-primary">
                              <Eye className="size-4" />
                            </button>
                          }
                        />
                        <Detail label="Host / IP" value={textMetadata(selected, "host")} copy />
                        <Detail label="Port" value={textMetadata(selected, "port")} />
                        <Detail label="Protocol" value={textMetadata(selected, "protocol")} />
                        <Detail label="Description" value={textMetadata(selected, "description")} />
                        <Detail
                          label="Tags"
                          value={
                            <div className="flex flex-wrap gap-1.5">
                              {credentialTags(selected).length
                                ? credentialTags(selected).map((tag) => (
                                    <Badge key={tag} tone="blue">
                                      {tag}
                                    </Badge>
                                  ))
                                : "Not set"}
                            </div>
                          }
                        />
                        <Detail
                          label="Project"
                          value={selected.project ? projectNames.get(selected.project) || "Linked project" : "Not set"}
                        />
                        <Detail
                          label="Environment"
                          value={<Badge tone="green">{textMetadata(selected, "environment")}</Badge>}
                        />
                        <Detail label="Created By" value={selectedOwner?.display_name || "Not available"} />
                      </dl>
                    </div>
                    <div className="space-y-4">
                      <div className="rounded-xl border border-subtle p-4">
                        <h4 className="text-sm font-semibold text-primary">Quick Actions</h4>
                        <div className="mt-3 grid gap-1">
                          <Action icon={Eye} label="Reveal Password" onClick={() => setManageOpen(true)} />
                          <Action icon={Pencil} label="Update Credential" onClick={openEdit} />
                          <Action icon={Clock3} label="Rotate Password" onClick={() => setManageOpen(true)} />
                          <Action icon={UserRoundPlus} label="Share Access" onClick={() => setManageOpen(true)} />
                          <Action icon={Copy} label="Duplicate" disabled />
                          <Action icon={Trash2} label="Delete" danger onClick={() => setManageOpen(true)} />
                        </div>
                      </div>
                      <div className="rounded-xl border border-subtle p-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-primary">Access Summary</h4>
                          <button
                            type="button"
                            onClick={() => setActiveTab("Access")}
                            className="text-[11px] text-accent-primary"
                          >
                            View all
                          </button>
                        </div>
                        <dl className="mt-3 grid gap-3">
                          <MiniDetail label="Owner" value={selectedOwner?.display_name || "Not available"} />
                          <MiniDetail label="Users with access" value={String(accessData?.grants.length ?? 0)} />
                          <MiniDetail label="Last accessed" value={formatRelative(lastUsed)} />
                        </dl>
                      </div>
                    </div>
                  </div>
                ) : activeTab === "Access" ? (
                  <PanelList
                    title="Users with access"
                    empty="No active credential grants."
                    error={accessError}
                    items={
                      accessData?.grants.map((grant) => ({
                        id: grant.id,
                        title: getUserDetails(grant.member)?.display_name || grant.member,
                        detail: `${grant.permission} access${grant.expires_at ? ` · expires ${formatDate(grant.expires_at)}` : ""}`,
                      })) ?? []
                    }
                  />
                ) : activeTab === "Activity Log" ? (
                  <PanelList
                    title="Audit trail"
                    empty="No credential activity."
                    error={accessError}
                    items={
                      accessData?.audit.map((audit) => ({
                        id: audit.id,
                        title: audit.action.replaceAll("_", " "),
                        detail: `${formatDate(audit.created_at)}${audit.member ? ` · ${getUserDetails(audit.member)?.display_name || audit.member}` : ""}`,
                      })) ?? []
                    }
                  />
                ) : (
                  <SummonRequestState
                    empty
                    emptyMessage={`No ${activeTab.toLowerCase()} data source is configured for credentials.`}
                  />
                )}
              </div>
              <div className="text-xs mx-5 mb-5 flex gap-3 rounded-xl bg-accent-subtle/50 p-4 text-secondary">
                <ShieldCheck className="size-4 flex-none text-accent-primary" />
                <p>
                  This credential is encrypted and stored securely. Secret values are revealed only after password
                  confirmation and are audited.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {formOpen ? (
        <CredentialForm
          credential={editingCredential}
          projects={projects}
          saving={saving}
          error={formError}
          onClose={() => setFormOpen(false)}
          onSubmit={saveCredential}
        />
      ) : null}
      <CredentialDrawer
        workspaceSlug={workspaceSlug}
        credential={manageOpen ? selected : undefined}
        onClose={() => setManageOpen(false)}
        onChanged={() => void mutate()}
      />
    </section>
  );
}

function Metric(props: {
  icon: typeof LockKeyhole;
  tone: "blue" | "green" | "orange" | "purple" | "red";
  label: string;
  value: React.ReactNode;
  detail: string;
}) {
  const tones = {
    blue: "bg-blue-500/10 text-blue-600",
    green: "bg-green-500/10 text-green-600",
    orange: "bg-amber-500/10 text-amber-600",
    purple: "bg-violet-500/10 text-violet-600",
    red: "bg-red-500/10 text-red-600",
  };
  const Icon = props.icon;
  return (
    <div className="flex min-w-0 items-center gap-4 rounded-2xl border border-subtle bg-surface-1 p-4">
      <span className={`grid size-12 flex-none place-items-center rounded-xl ${tones[props.tone]}`}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-secondary">{props.label}</p>
        <p className="text-2xl mt-1 font-semibold tracking-tight text-primary">{props.value}</p>
        <p className="mt-1 truncate text-[10px] text-tertiary">{props.detail}</p>
      </div>
    </div>
  );
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "blue" | "green" }) {
  const tones = {
    neutral: "bg-layer-2 text-secondary",
    blue: "bg-blue-500/10 text-blue-600",
    green: "bg-green-500/10 text-green-600",
  };
  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-medium capitalize ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Status({ value }: { value: ISummonCredential["status"] }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium capitalize ${value === "active" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {value}
    </span>
  );
}

function Detail({
  label,
  value,
  copy,
  action,
}: {
  label: string;
  value: React.ReactNode;
  copy?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-3">
      <dt className="text-secondary">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 font-medium text-primary">
        <span className="min-w-0 break-words">{value}</span>
        {copy ? <Copy className="size-3.5 flex-none text-tertiary" /> : null}
        {action}
      </dd>
    </div>
  );
}

function MiniDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-[11px]">
      <dt className="text-secondary">{label}</dt>
      <dd className="text-right font-medium text-primary">{value}</dd>
    </div>
  );
}

function Action(props: {
  icon: typeof Eye;
  label: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const Icon = props.icon;
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={`text-xs flex items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-layer-1 disabled:cursor-not-allowed disabled:opacity-40 ${props.danger ? "text-danger-primary" : "text-primary"}`}
    >
      <Icon className="size-3.5" />
      {props.label}
    </button>
  );
}

function PanelList(props: {
  title: string;
  empty: string;
  error?: unknown;
  items: Array<{ id: string; title: string; detail: string }>;
}) {
  if (props.error) return <SummonRequestState error={props.error} />;
  return (
    <div className="rounded-xl border border-subtle">
      <h3 className="text-sm border-b border-subtle px-4 py-3 font-semibold text-primary">{props.title}</h3>
      <div className="divide-y divide-subtle">
        {props.items.map((item) => (
          <div key={item.id} className="px-4 py-3">
            <p className="text-xs font-medium text-primary capitalize">{item.title}</p>
            <p className="mt-1 text-[10px] text-secondary">{item.detail}</p>
          </div>
        ))}
        {!props.items.length ? <p className="text-xs p-4 text-tertiary">{props.empty}</p> : null}
      </div>
    </div>
  );
}

function CredentialForm(props: {
  credential: ISummonCredential | null;
  projects: Array<{ id: string; name: string }>;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const metadata = props.credential?.metadata ?? {};
  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-backdrop p-4"
      role="dialog"
      aria-modal="true"
      aria-label={props.credential ? "Update credential" : "Add credential"}
    >
      <div className="vertical-scrollbar shadow-xl max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-subtle bg-surface-1 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary">
            {props.credential ? "Update Credential" : "Add Credential"}
          </h2>
          <button type="button" onClick={props.onClose} aria-label="Close">
            <X className="size-4 text-secondary" />
          </button>
        </div>
        <form onSubmit={props.onSubmit} className="mt-5 grid gap-3 sm:grid-cols-2">
          <Input name="name" required defaultValue={props.credential?.name} placeholder="Credential name" />
          <Input
            name="account_identifier"
            defaultValue={props.credential?.account_identifier}
            placeholder="Account identifier"
          />
          <SummonField label="Provider">
            <SummonSelect name="provider" defaultValue={props.credential?.provider || "plane_mcp"}>
              <option value="plane_mcp">Plane MCP PAT</option>
              <option value="server">Server</option>
              <option value="database">Database</option>
              <option value="github">GitHub</option>
              <option value="figma">Figma</option>
              <option value="other">Other</option>
            </SummonSelect>
          </SummonField>
          <SummonField label="Project">
            <SummonSelect name="project" defaultValue={props.credential?.project || ""}>
              <option value="">No project</option>
              {props.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </SummonSelect>
          </SummonField>
          {!props.credential ? (
            <Input name="secret" type="password" required autoComplete="new-password" placeholder="Secret or PAT" />
          ) : null}
          <Input
            name="environment"
            defaultValue={typeof metadata.environment === "string" ? metadata.environment : ""}
            placeholder="Environment"
          />
          <Input
            name="host"
            defaultValue={typeof metadata.host === "string" ? metadata.host : ""}
            placeholder="Host / IP"
          />
          <Input name="port" defaultValue={typeof metadata.port === "string" ? metadata.port : ""} placeholder="Port" />
          <Input
            name="protocol"
            defaultValue={typeof metadata.protocol === "string" ? metadata.protocol : ""}
            placeholder="Protocol"
          />
          <Input
            name="expires_at"
            type="date"
            defaultValue={typeof metadata.expires_at === "string" ? metadata.expires_at.slice(0, 10) : ""}
          />
          <Input
            name="tags"
            defaultValue={Array.isArray(metadata.tags) ? metadata.tags.join(", ") : ""}
            placeholder="Tags, comma separated"
          />
          <SummonField label="Risk">
            <SummonSelect name="risk" defaultValue={typeof metadata.risk === "string" ? metadata.risk : ""}>
              <option value="">Not assessed</option>
              <option value="low">Low</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </SummonSelect>
          </SummonField>
          <textarea
            name="description"
            rows={3}
            defaultValue={typeof metadata.description === "string" ? metadata.description : ""}
            placeholder="Description"
            className="text-xs rounded-md border border-subtle bg-surface-1 p-2 text-primary sm:col-span-2"
          />
          <p className="text-[10px] text-tertiary sm:col-span-2">
            Secrets are encrypted server-side and are never returned in list responses.
          </p>
          {props.error ? <p className="text-xs text-danger-primary sm:col-span-2">{props.error}</p> : null}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="neutral-primary" onClick={props.onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={props.saving}>
              <Check className="mr-1.5 size-3.5" />
              Save credential
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
