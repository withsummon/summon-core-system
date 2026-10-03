import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import { useStickiesCommands } from "@/components/stickies/native/provider";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useOutletContext } from "react-router";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { SensitiveOperation } from "@/components/convex-core/credentials/sensitive-operation";
import { CredentialAccess, CredentialAudit } from "@/components/convex-core/credentials/access";
import { credentialInput } from "@summon/convex/credential-schema";
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
import { Button } from "@plane/propel/button";
import { Input } from "@plane/ui";

import { PageHead } from "@/components/core/page-title";

import { SummonField } from "@/components/summon/forms";
import { SummonRequestState } from "@/components/summon/request-state";
import { summonErrorMessage } from "@/components/summon/screen";

import { Select } from "@plane/propel/select";
import { Dialog, EDialogWidth } from "@plane/propel/dialog";
import { DatePicker } from "@plane/propel/date-picker";

const tabs = ["Overview", "Access", "Activity Log", "Attachments", "Notes"] as const;

const textMetadata = (
  credential: FunctionReturnType<typeof api.mcp.credentials.list>["page"][number],
  key: "environment" | "description" | "host" | "port" | "protocol"
) => credential.metadata?.[key] || "Not set";
const credentialTags = (credential: FunctionReturnType<typeof api.mcp.credentials.list>["page"][number]) =>
  credential.metadata?.tags ?? [];
const formatDate = (value?: number | null) => {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
};

const formatRelative = (value?: number | null) => {
  if (!value) return "Never";
  return formatDate(value);
};

export default function SummonCredentialsPage() {
  const session = useOutletContext<WorkspaceSession>();
  const { user: currentUser, workspace } = session;
  const commands = useStickiesCommands();
  const create = useAction(api.mcp.vault.create);
  const update = useMutation(api.mcp.credentials.update);
  const [operation, setOperation] = useState<FunctionArgs<typeof api.mcp.stepUp.verify>["operation"] | null>(null);
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Overview");
  const [selectedId, setSelectedId] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCredential, setEditingCredential] = useState<
    FunctionReturnType<typeof api.mcp.credentials.list>["page"][number] | null
  >(null);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const list = usePaginatedQuery(api.mcp.credentials.list, { workspaceId: workspace._id }, { initialNumItems: 100 });
  const projects = useQuery(api.projects.index.list, { workspaceId: workspace._id }) ?? [];
  const members = usePaginatedQuery(
    api.commercial.directory.members,
    { workspaceId: workspace._id },
    { initialNumItems: 100 }
  );
  const data = list.results;
  const isLoading = list.status !== "Exhausted";
  const selected = data.find((row) => row._id === selectedId) ?? data[0];
  const detail = useQuery(api.mcp.credentials.resolve, selected ? { credentialId: selected._id } : "skip");
  const canManage = detail?.canManage;
  const { status: listStatus, loadMore: loadList } = list;
  useEffect(() => {
    if (listStatus === "CanLoadMore") loadList(100);
  }, [listStatus, loadList]);
  const { status: membersStatus, loadMore: loadMembers } = members;
  useEffect(() => {
    if (membersStatus === "CanLoadMore") loadMembers(100);
  }, [membersStatus, loadMembers]);
  useEffect(() => setNow(new Date()), []);

  const projectNames = new Map(projects.map((project) => [project._id, project.name]));
  const filtered = (() => {
    const normalized = query.trim().toLowerCase();
    return (data ?? []).filter((credential) => {
      if (projectFilter !== "all" && credential.projectId !== projectFilter) return false;
      const projectName = credential.projectId ? projectNames.get(credential.projectId) : "";
      return [credential.name, credential.provider ?? "plane_mcp", credential.accountIdentifier, projectName]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized));
    });
  })();
  const metrics = useMemo(
    () => ({
      total: data.length,
      active: data.filter((row) => row.status === "active").length,
      sharedWithMe: data.filter((row) => row.ownerId !== currentUser.id).length,
      expiringSoon: data.filter(
        (row) =>
          row.metadata?.expiresAt != null &&
          now &&
          row.metadata.expiresAt > now.getTime() &&
          row.metadata.expiresAt <= now.getTime() + 30 * 86400000
      ).length,
      risky: data.filter((row) => ["high", "critical"].includes(row.metadata?.risk ?? "")).length,
    }),
    [data, currentUser.id, now]
  );
  const selectedOwner = members.results.find((row) => row.id === selected?.ownerId);
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
    setSaving(true);
    setFormError("");
    try {
      const payload = credentialInput.parse({
        name: form.get("name") || "",
        provider: form.get("provider") || "",
        accountIdentifier: form.get("account_identifier") || "",
        projectId: form.get("project") || null,
        remoteWorkspaceSlug: form.get("remote_workspace") || "",
        remoteProjectId: form.get("remote_project") || null,
        metadata: {
          environment: form.get("environment") || "",
          description: form.get("description") || "",
          host: form.get("host") || "",
          port: form.get("port") || "",
          protocol: form.get("protocol") || "",
          expiresAt: form.get("expires_at") ? new Date(String(form.get("expires_at"))).getTime() : null,
          tags: String(form.get("tags") || "")
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          risk: form.get("risk") || "",
        },
      });
      const saved = editingCredential
        ? await update({
            credentialId: editingCredential._id,
            expectedRevision: editingCredential.revision,
            ...payload,
          }).then(() => editingCredential._id)
        : await create({ workspaceId: workspace._id, ...payload, secret: String(form.get("secret") || "") });
      setSelectedId(saved);
      setFormOpen(false);
    } catch (requestError) {
      setFormError(summonErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
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
            <Button variant="secondary" size="lg">
              <Filter className="mr-1.5 size-3.5" /> Filter
            </Button>
            <Button size="lg" disabled={workspace.membershipRole === "guest"} onClick={openCreate}>
              <Plus className="mr-1.5 size-3.5" /> Add Credential <ChevronDown className="ml-2 size-3.5" />
            </Button>
          </div>
        </header>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {(
            [
              {
                icon: LockKeyhole,
                tone: "blue",
                label: "Total Credentials",
                value: metrics.total,
                detail: "Accessible to you",
              },
              { icon: KeyRound, tone: "green", label: "Active Accounts", value: metrics.active, detail: "Not revoked" },
              {
                icon: UsersRound,
                tone: "orange",
                label: "Shared With Me",
                value: metrics.sharedWithMe,
                detail: "Owned by another member",
              },
              {
                icon: ShieldCheck,
                tone: "purple",
                label: "Expiring Soon",
                value: metrics.expiringSoon,
                detail: "Within 30 days",
              },
              {
                icon: AlertTriangle,
                tone: "red",
                label: "Risky Credentials",
                value: metrics.risky,
                detail: "Marked high or critical",
              },
            ] satisfies React.ComponentProps<typeof Metric>[]
          ).map((metric) => (
            <Metric key={metric.label} {...metric} value={isLoading ? "—" : metric.value} />
          ))}
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
              <Select
                value={projectFilter}
                onValueChange={(value) => setProjectFilter(value)}
                className="w-40"
                options={[
                  { value: "all", label: "All Projects" },
                  ...projects.map((project) => ({ value: project._id, label: project.name })),
                ]}
              />
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
            {isLoading ? (
              <div className="p-4">
                <SummonRequestState loading={isLoading} />
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
                        key={credential._id}
                        className={selected?._id === credential._id ? "bg-accent-subtle/50" : "hover:bg-layer-1"}
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setSelectedId(credential._id)}
                            className="flex w-full items-center gap-3 text-left"
                          >
                            <span className="grid size-8 flex-none place-items-center rounded-lg bg-accent-subtle text-accent-primary">
                              <Server className="size-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-primary">{credential.name}</span>
                              <span className="mt-0.5 block truncate text-[10px] text-secondary">
                                {credential.accountIdentifier || "No account identifier"}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td className="px-3 py-3">
                          <Badge>{(credential.provider ?? "plane_mcp").replaceAll("_", " ")}</Badge>
                        </td>
                        <td className="px-3 py-3 text-secondary">
                          {credential.projectId ? projectNames.get(credential.projectId) || "Linked project" : "—"}
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone="green">{textMetadata(credential, "environment")}</Badge>
                        </td>
                        <td className="px-3 py-3 text-secondary">{formatRelative(credential.lastUsedAt)}</td>
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
                      {(selected.provider ?? "plane_mcp").replaceAll("_", " ")} ·{" "}
                      {textMetadata(selected, "environment")}
                    </p>
                    <p className="mt-2 text-[11px] text-tertiary">
                      Last used {formatRelative(selected.lastUsedAt)} · Created {formatDate(selected._creationTime)}
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
                    <CredentialOverview
                      credential={selected}
                      detail={detail}
                      ownerName={selectedOwner?.name}
                      projectName={selected.projectId ? projectNames.get(selected.projectId) : undefined}
                      onOperation={setOperation}
                      onEdit={openEdit}
                      onAccess={() => setActiveTab("Access")}
                    />
                  ) : activeTab === "Access" ? (
                    canManage ? (
                      <CredentialAccess credential={detail} />
                    ) : (
                      <p>Management access is required to view or change grants.</p>
                    )
                  ) : activeTab === "Activity Log" ? (
                    canManage ? (
                      <CredentialAudit credentialId={detail._id} />
                    ) : (
                      <p>Management access is required to view the audit trail.</p>
                    )
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

        {formOpen && (
          <CredentialForm
            credential={editingCredential}
            projects={projects.map((row) => ({ id: row._id, name: row.name }))}
            saving={saving}
            error={formError}
            onClose={() => setFormOpen(false)}
            onSubmit={saveCredential}
          />
        )}
        {operation && detail && (
          <SensitiveOperation
            credentialId={detail._id}
            operation={operation}
            onClose={() => setOperation(null)}
            onDeleted={() => {
              setSelectedId("");
              setOperation(null);
            }}
          />
        )}
      </section>
    </PreservedWorkspaceShell>
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

function Status({ value }: { value: FunctionReturnType<typeof api.mcp.credentials.list>["page"][number]["status"] }) {
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

function CredentialForm(props: {
  credential: FunctionReturnType<typeof api.mcp.credentials.list>["page"][number] | null;
  projects: Array<{ id: string; name: string }>;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const metadata = props.credential?.metadata;
  return (
    <Dialog open onOpenChange={(open) => !open && !props.saving && props.onClose()}>
      <Dialog.Panel
        width={EDialogWidth.XXL}
        className="vertical-scrollbar max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl p-5"
      >
        <div className="flex items-center justify-between">
          <Dialog.Title className="text-18 font-semibold text-primary">
            {props.credential ? "Update Credential" : "Add Credential"}
          </Dialog.Title>
          <button type="button" disabled={props.saving} onClick={props.onClose} aria-label="Close">
            <X className="size-4 text-secondary" />
          </button>
        </div>
        <form onSubmit={props.onSubmit} className="mt-5 grid gap-3 sm:grid-cols-2">
          <Input name="name" required defaultValue={props.credential?.name} placeholder="Credential name" />
          <Input
            name="account_identifier"
            defaultValue={props.credential?.accountIdentifier}
            placeholder="Account identifier"
          />
          <SummonField label="Provider">
            <Select
              name="provider"
              defaultValue={props.credential?.provider || "plane_mcp"}
              options={[
                { value: "plane_mcp", label: "Plane MCP PAT" },
                { value: "server", label: "Server" },
                { value: "database", label: "Database" },
                { value: "github", label: "GitHub" },
                { value: "figma", label: "Figma" },
                { value: "other", label: "Other" },
              ]}
            />
          </SummonField>
          <SummonField label="Project">
            <Select
              name="project"
              defaultValue={props.credential?.projectId || ""}
              options={[
                { value: "", label: "No project" },
                ...props.projects.map((project) => ({ value: project.id, label: project.name })),
              ]}
            />
          </SummonField>
          <Input
            name="remote_workspace"
            defaultValue={props.credential?.remoteWorkspaceSlug}
            placeholder="Remote workspace slug (Plane MCP only)"
          />
          <Input
            name="remote_project"
            defaultValue={props.credential?.remoteProjectId ?? ""}
            placeholder="Remote project ID (Plane MCP project scope)"
          />
          {!props.credential ? (
            <Input name="secret" type="password" required autoComplete="new-password" placeholder="Secret or PAT" />
          ) : null}
          {(["environment", "host", "port", "protocol"] as const).map((field) => (
            <Input
              key={field}
              name={field}
              defaultValue={metadata?.[field]}
              placeholder={field === "host" ? "Host / IP" : field}
            />
          ))}
          <DatePicker
            name="expires_at"
            aria-label="Expires on"
            placeholder="Expiry date"
            defaultValue={metadata?.expiresAt ? new Date(metadata.expiresAt).toISOString().slice(0, 10) : ""}
          />
          <Input name="tags" defaultValue={metadata?.tags.join(", ")} placeholder="Tags, comma separated" />
          <SummonField label="Risk">
            <Select
              name="risk"
              defaultValue={metadata?.risk}
              options={[
                { value: "", label: "Not assessed" },
                { value: "low", label: "Low" },
                { value: "high", label: "High" },
                { value: "critical", label: "Critical" },
              ]}
            />
          </SummonField>
          <textarea
            name="description"
            rows={3}
            defaultValue={metadata?.description}
            placeholder="Description"
            className="text-xs rounded-md border border-subtle bg-surface-1 p-2 text-primary sm:col-span-2"
          />
          <p className="text-[10px] text-tertiary sm:col-span-2">
            Secrets are encrypted server-side and are never returned in list responses.
          </p>
          {props.error ? <p className="text-xs text-danger-primary sm:col-span-2">{props.error}</p> : null}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button size="xl" type="button" disabled={props.saving} variant="secondary" onClick={props.onClose}>
              Cancel
            </Button>
            <Button size="xl" type="submit" loading={props.saving}>
              <Check className="mr-1.5 size-3.5" />
              Save credential
            </Button>
          </div>
        </form>
      </Dialog.Panel>
    </Dialog>
  );
}

function CredentialOverview({
  credential,
  detail,
  ownerName,
  projectName,
  onOperation,
  onEdit,
  onAccess,
}: {
  credential: FunctionReturnType<typeof api.mcp.credentials.list>["page"][number];
  detail: FunctionReturnType<typeof api.mcp.credentials.resolve> | undefined;
  ownerName: string | null | undefined;
  projectName: string | undefined;
  onOperation: (operation: FunctionArgs<typeof api.mcp.stepUp.verify>["operation"]) => void;
  onEdit: () => void;
  onAccess: () => void;
}) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
      <div className="rounded-xl border border-subtle p-4">
        <dl className="text-xs grid gap-4">
          <Detail label="Username" value={credential.accountIdentifier || "Not set"} copy />
          <Detail
            label="Password"
            value={"••••••••"}
            action={
              <button
                type="button"
                disabled={!detail?.canReveal}
                aria-label="Reveal secret"
                onClick={() => onOperation("reveal")}
                className="text-accent-primary"
              >
                <Eye className="size-4" />
              </button>
            }
          />
          <Detail label="Host / IP" value={textMetadata(credential, "host")} copy />
          <Detail label="Port" value={textMetadata(credential, "port")} />
          <Detail label="Protocol" value={textMetadata(credential, "protocol")} />
          <Detail label="Description" value={textMetadata(credential, "description")} />
          <Detail
            label="Tags"
            value={
              <div className="flex flex-wrap gap-1.5">
                {credentialTags(credential).length
                  ? credentialTags(credential).map((tag) => (
                      <Badge key={tag} tone="blue">
                        {tag}
                      </Badge>
                    ))
                  : "Not set"}
              </div>
            }
          />
          <Detail label="Project" value={credential.projectId ? projectName || "Linked project" : "Not set"} />
          <Detail label="Environment" value={<Badge tone="green">{textMetadata(credential, "environment")}</Badge>} />
          <Detail label="Created By" value={ownerName || "Not available"} />
        </dl>
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border border-subtle p-4">
          <h4 className="text-sm font-semibold text-primary">Quick Actions</h4>
          <div className="mt-3 grid gap-1">
            <Action
              icon={Eye}
              label="Reveal Password"
              disabled={!detail?.canReveal}
              onClick={() => onOperation("reveal")}
            />
            <Action icon={Pencil} label="Update Credential" disabled={!detail?.canManage} onClick={onEdit} />
            <Action
              icon={Clock3}
              label="Rotate Password"
              disabled={!detail?.canManage}
              onClick={() => onOperation("rotate")}
            />
            <Action icon={UserRoundPlus} label="Share Access" disabled={!detail?.canManage} onClick={onAccess} />
            <Action icon={Copy} label="Duplicate" disabled />
            <Action
              icon={Trash2}
              label="Delete"
              danger
              disabled={!detail?.canManage}
              onClick={() => onOperation("delete")}
            />
          </div>
        </div>
        <div className="rounded-xl border border-subtle p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-primary">Access Summary</h4>
            <button type="button" onClick={onAccess} className="text-[11px] text-accent-primary">
              View all
            </button>
          </div>
          <dl className="mt-3 grid gap-3">
            <MiniDetail label="Owner" value={ownerName || "Not available"} />

            <MiniDetail label="Last accessed" value={formatRelative(credential.lastAccessedAt)} />
          </dl>
        </div>
      </div>
    </div>
  );
}
