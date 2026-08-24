/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleEllipsis,
  ExternalLink,
  FileText,
  FolderKanban,
  Mail,
  Pencil,
  Phone,
  Target,
  X,
} from "lucide-react";
import { Button, Input } from "@plane/ui";
import { PageHead } from "@/components/core/page-title";
import { SummonRequestState } from "@/components/summon/request-state";
import { summonErrorMessage } from "@/components/summon/screen";
import { useMember } from "@/hooks/store/use-member";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";

const formatDate = (value?: string | null) => {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
};

const statusLabel = (value: string) => value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());

const CLIENT_TABS = [
  { id: "overview", label: "Overview" },
  { id: "opportunities", label: "Opportunities" },
  { id: "projects", label: "Projects" },
  { id: "contacts", label: "Contacts" },
  { id: "documents", label: "Documents" },
  { id: "activity", label: "Activity" },
  { id: "notes", label: "Notes" },
  { id: "settings", label: "Settings" },
] as const;

type TClientTab = (typeof CLIENT_TABS)[number]["id"];

export default function SummonClientDetailPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, clientId } = params;
  const { getUserDetails } = useMember();
  const [activeTab, setActiveTab] = useState<TClientTab>("overview");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const { data, error, isLoading, mutate } = useSWR(["summon-client", workspaceSlug, clientId], () =>
    summonService.getClientDetail(workspaceSlug, clientId)
  );

  if (!data) return <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />;

  const activeOpportunities = data.opportunities.filter(({ stage }) => stage !== "won" && stage !== "lost");
  const owner = data.owner ? getUserDetails(data.owner) : undefined;
  const lastInteraction = data.recent_activity[0];
  const showTab = (tab: TClientTab) => activeTab === "overview" || activeTab === tab;
  const visiblePageContexts = data.page_contexts.filter((context) =>
    activeTab === "documents" ? context.category === "document" : context.category !== "document"
  );

  const updateClient = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setFormError("");
    try {
      await summonService.updateClient(workspaceSlug, clientId, {
        name: form.get("name"),
        company_name: form.get("company_name"),
        industry: form.get("industry"),
        website: form.get("website"),
        head_office: form.get("head_office"),
        relationship_started_at: form.get("relationship_started_at") || null,
        notes: form.get("notes"),
        status: form.get("status"),
      });
      await mutate();
      setEditing(false);
    } catch (requestError) {
      setFormError(summonErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mx-auto min-h-full w-full max-w-[1600px] overflow-hidden p-4 lg:p-5">
      <PageHead title={`${data.name} · Summon Core`} />
      <div className="flex items-center gap-2 text-[11px] text-secondary">
        <Link href={`/${workspaceSlug}/summon/clients/`} className="hover:text-primary">
          Clients
        </Link>
        <ChevronRight className="size-3" />
        <span className="font-medium text-primary">{data.name}</span>
      </div>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="text-2xl shadow-sm grid size-24 shrink-0 place-items-center rounded-2xl border border-subtle bg-surface-1 font-semibold text-accent-primary">
            {data.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-primary">{data.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-secondary">
              <span className="rounded-full bg-success-subtle px-2.5 py-1 font-medium text-success-primary">
                {statusLabel(data.status)} Client
              </span>
              <span>•</span>
              <span>Since {formatDate(data.relationship_started_at)}</span>
              <span>•</span>
              <span>{data.industry || "Industry not set"}</span>
            </div>
            <p className="text-xs mt-2 max-w-3xl leading-5 text-secondary">
              {data.notes || "No client relationship notes yet."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="grid size-10 place-items-center rounded-xl border border-subtle bg-surface-1 text-secondary"
            aria-label="More client actions"
          >
            <CircleEllipsis className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs inline-flex h-10 items-center gap-2 rounded-xl bg-accent-primary px-5 font-medium text-white"
          >
            <Pencil className="size-3.5" /> Edit Client
          </button>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-xl bg-accent-primary text-white"
            aria-label="Open client actions"
          >
            <ChevronDown className="size-4" />
          </button>
        </div>
      </header>

      <nav className="mt-5 flex gap-8 overflow-x-auto border-b border-subtle text-[11px] font-medium text-secondary">
        {CLIENT_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 border-b-2 px-0.5 pb-3 ${activeTab === tab.id ? "border-accent-primary text-accent-primary" : "border-transparent"}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div
        className={`mt-4 grid min-w-0 items-start gap-4 ${activeTab === "overview" ? "xl:grid-cols-[minmax(0,1fr)_20rem]" : "grid-cols-1"}`}
      >
        <main className="min-w-0 space-y-4">
          {activeTab === "overview" ? (
            <section className="grid overflow-hidden rounded-xl border border-subtle bg-surface-1 sm:grid-cols-2 lg:grid-cols-4">
              <ClientMetric
                icon={<Target className="size-4.5" />}
                label="Active Opportunities"
                value={activeOpportunities.length}
                detail="View opportunities"
              />
              <ClientMetric
                icon={<FolderKanban className="size-4.5" />}
                label="Active Projects"
                value={data.projects.length}
                detail="View projects"
              />
              <ClientMetric
                icon={<Building2 className="size-4.5" />}
                label="Total Projects"
                value={data.projects.length}
                detail="Visible Plane projects"
              />
              <ClientMetric
                icon={<CalendarDays className="size-4.5" />}
                label="Last Interaction"
                value={lastInteraction ? formatDate(lastInteraction.created_at) : "No activity"}
                detail={lastInteraction?.label || "Nothing recorded"}
              />
            </section>
          ) : null}

          {showTab("opportunities") ? (
            <DataSection
              title="Active Opportunities"
              action="View all opportunities"
              href={`/${workspaceSlug}/summon/opportunities/`}
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-[10px]">
                  <thead className="border-y border-subtle bg-layer-1/40 text-secondary">
                    <tr>
                      {["Opportunity", "Stage", "Owner", "Value (IDR)", "Close Date", "Progress"].map((label) => (
                        <th key={label} className="px-4 py-3 font-medium">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-subtle">
                    {activeOpportunities.map((opportunity) => {
                      const opportunityOwner = opportunity.owner ? getUserDetails(opportunity.owner) : undefined;
                      return (
                        <tr key={opportunity.id}>
                          <td className="px-4 py-3">
                            <Link
                              href={`/${workspaceSlug}/summon/opportunities/${opportunity.id}/`}
                              className="font-semibold text-primary"
                            >
                              {opportunity.title}
                            </Link>
                            <p className="mt-1 text-tertiary">{opportunity.product || "Product not set"}</p>
                          </td>
                          <td className="px-4 py-3">
                            <Badge>{statusLabel(opportunity.stage)}</Badge>
                          </td>
                          <td className="px-4 py-3 text-primary">{opportunityOwner?.display_name || "Not assigned"}</td>
                          <td className="px-4 py-3 text-primary">{opportunity.value || "—"}</td>
                          <td className="px-4 py-3 text-primary">{formatDate(opportunity.expected_close_date)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-accent-primary">{opportunity.probability}%</span>
                              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-layer-2">
                                <div
                                  className="h-full rounded-full bg-accent-primary"
                                  style={{ width: `${opportunity.probability}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!activeOpportunities.length ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-tertiary">
                          No active opportunities linked to this client.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </DataSection>
          ) : null}

          {showTab("projects") ? (
            <DataSection title="Recent Projects" action="View all projects" href={`/${workspaceSlug}/summon/projects/`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-[10px]">
                  <thead className="border-y border-subtle bg-layer-1/40 text-secondary">
                    <tr>
                      {["Project", "Type", "Status", "Owner", "Start Date", "End Date"].map((label) => (
                        <th key={label} className="px-4 py-3 font-medium">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-subtle">
                    {data.projects.slice(0, 5).map((project) => (
                      <tr key={project.id}>
                        <td className="px-4 py-3">
                          <Link
                            href={`/${workspaceSlug}/summon/projects/${project.id}/`}
                            className="font-semibold text-primary"
                          >
                            {project.name}
                          </Link>
                          <p className="mt-1 text-tertiary">{project.identifier}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge>Plane Project</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 rounded-full bg-success-subtle px-2 py-1 text-success-primary">
                            <CheckCircle2 className="size-3" /> Linked
                          </span>
                        </td>
                        <td className="px-4 py-3 text-tertiary">Not available</td>
                        <td className="px-4 py-3 text-tertiary">Not available</td>
                        <td className="px-4 py-3 text-tertiary">Not available</td>
                      </tr>
                    ))}
                    {!data.projects.length ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-tertiary">
                          No visible Plane projects linked to this client.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </DataSection>
          ) : null}

          {showTab("contacts") ? (
            <DataSection title="Key Contacts" action="View all contacts">
              <div className="grid gap-3 p-4 md:grid-cols-2 2xl:grid-cols-3">
                {data.contacts.slice(0, 3).map((contact) => (
                  <article key={contact.id} className="flex min-w-0 gap-3 rounded-xl border border-subtle p-3">
                    <span className="text-sm grid size-11 shrink-0 place-items-center rounded-full bg-accent-subtle font-semibold text-accent-primary">
                      {contact.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-[11px] font-semibold text-primary">{contact.name}</h3>
                      <p className="mt-0.5 truncate text-[10px] text-secondary">{contact.title || "Role not set"}</p>
                      {contact.email ? (
                        <a
                          href={`mailto:${contact.email}`}
                          className="mt-1 block truncate text-[10px] text-accent-primary"
                        >
                          {contact.email}
                        </a>
                      ) : null}
                      {contact.phone ? (
                        <a href={`tel:${contact.phone}`} className="mt-1 block truncate text-[10px] text-secondary">
                          {contact.phone}
                        </a>
                      ) : null}
                      <div className="mt-2 flex gap-2">
                        <span className="grid size-6 place-items-center rounded-md bg-layer-1 text-accent-primary">
                          <Mail className="size-3" />
                        </span>
                        <span className="grid size-6 place-items-center rounded-md bg-layer-1 text-accent-primary">
                          <Phone className="size-3" />
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
                {!data.contacts.length ? (
                  <p className="py-8 text-center text-[10px] text-tertiary md:col-span-2 2xl:col-span-3">
                    No contacts added.
                  </p>
                ) : null}
              </div>
            </DataSection>
          ) : null}

          {showTab("activity") ? (
            <DataSection title="Recent Activity" action="View all activity">
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
                {data.recent_activity.slice(0, 5).map((activity) => (
                  <Link key={activity.id} href={activity.href} className="flex min-w-0 items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-subtle text-accent-primary">
                      <FileText className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[10px] font-semibold text-primary">{activity.label}</span>
                      <time className="mt-1 block text-[9px] text-secondary" dateTime={activity.created_at}>
                        {formatDate(activity.created_at)}
                      </time>
                    </span>
                  </Link>
                ))}
                {!data.recent_activity.length ? <p className="text-[10px] text-tertiary">No recent activity.</p> : null}
              </div>
            </DataSection>
          ) : null}

          {activeTab === "documents" || activeTab === "notes" ? (
            <DataSection
              title={activeTab === "documents" ? "Documents" : "Notes"}
              action={`${visiblePageContexts.length} linked pages`}
            >
              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {visiblePageContexts.map((context) => (
                  <article key={context.id} className="flex min-w-0 gap-3 rounded-xl border border-subtle p-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-subtle text-accent-primary">
                      <FileText className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-semibold text-primary">
                        {context.page_detail.name || "Untitled page"}
                      </p>
                      <p className="mt-1 text-[9px] text-secondary">
                        {statusLabel(context.category || "page")} · {formatDate(context.updated_at)}
                      </p>
                    </div>
                  </article>
                ))}
                {!visiblePageContexts.length ? (
                  <p className="py-8 text-center text-[10px] text-tertiary sm:col-span-2 xl:col-span-3">
                    No linked {activeTab}.
                  </p>
                ) : null}
              </div>
            </DataSection>
          ) : null}

          {activeTab === "settings" ? (
            <DataSection title="Client Settings" action="Manage client record">
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <Detail label="Legal Name" value={data.company_name || "Not set"} />
                <Detail label="Industry" value={data.industry || "Not set"} />
                <Detail label="Head Office" value={data.head_office || "Not set"} />
                <Detail label="Account Manager" value={owner?.display_name || "Not assigned"} />
                <div className="sm:col-span-2">
                  <Button type="button" onClick={() => setEditing(true)}>
                    <Pencil className="mr-2 size-3.5" /> Edit Client
                  </Button>
                </div>
              </div>
            </DataSection>
          ) : null}
        </main>

        {activeTab === "overview" ? (
          <aside className="min-w-0 space-y-4">
            <SideCard title="Relationship Health">
              <span className="inline-flex rounded-full bg-layer-2 px-2 py-1 text-[10px] font-medium text-secondary">
                Not scored
              </span>
              <p className="mt-2 text-[10px] leading-4 text-secondary">
                No relationship-health data source is configured.
              </p>
              <div className="mt-4 space-y-3">
                <HealthRow label="Communication records" detail={`${data.meetings.length} meetings linked`} />
                <HealthRow label="Projects tracked" detail={`${data.projects.length} visible projects`} />
                <HealthRow label="Client contacts" detail={`${data.contacts.length} contacts recorded`} />
              </div>
            </SideCard>

            <SideCard title="Client Information">
              <dl className="space-y-4">
                <Detail label="Legal Name" value={data.company_name || "Not set"} />
                <Detail label="Industry" value={data.industry || "Not set"} />
                <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 text-[10px]">
                  <dt className="text-secondary">Website</dt>
                  <dd className="min-w-0 font-medium text-primary">
                    {data.website ? (
                      <a
                        href={data.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-full items-center gap-1 truncate text-accent-primary"
                      >
                        {data.website.replace(/^https?:\/\//, "")}
                        <ExternalLink className="size-3 shrink-0" />
                      </a>
                    ) : (
                      "Not set"
                    )}
                  </dd>
                </div>
                <Detail label="Head Office" value={data.head_office || "Not set"} />
                <Detail label="Client Since" value={formatDate(data.relationship_started_at)} />
                <Detail label="Account Manager" value={owner?.display_name || "Not assigned"} />
              </dl>
            </SideCard>

            <SideCard title="Notes" action="View all notes">
              <div className="space-y-2">
                {data.page_contexts.slice(0, 3).map((context) => (
                  <div key={context.id} className="flex min-w-0 gap-3 rounded-lg border border-subtle p-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-subtle text-accent-primary">
                      <FileText className="size-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-semibold text-primary">
                        {context.page_detail.name || "Untitled page"}
                      </p>
                      <p className="mt-1 text-[9px] text-secondary">{formatDate(context.updated_at)}</p>
                    </div>
                  </div>
                ))}
                {!data.page_contexts.length ? <p className="py-4 text-[10px] text-tertiary">No linked notes.</p> : null}
              </div>
            </SideCard>
          </aside>
        ) : null}
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-client-title"
            className="shadow-2xl max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-subtle bg-surface-1 p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 id="edit-client-title" className="text-lg font-semibold text-primary">
                  Edit Client
                </h2>
                <p className="text-xs mt-1 text-secondary">Changes are saved to the Summon client record.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="grid size-8 place-items-center rounded-lg border border-subtle text-secondary"
                aria-label="Close edit client"
              >
                <X className="size-4" />
              </button>
            </div>
            <form onSubmit={updateClient} className="mt-5 grid gap-3 sm:grid-cols-2">
              <EditField label="Client name">
                <Input name="name" required defaultValue={data.name} />
              </EditField>
              <EditField label="Legal name">
                <Input name="company_name" defaultValue={data.company_name} />
              </EditField>
              <EditField label="Industry">
                <Input name="industry" defaultValue={data.industry} />
              </EditField>
              <EditField label="Website">
                <Input name="website" type="url" defaultValue={data.website} />
              </EditField>
              <EditField label="Head office">
                <Input name="head_office" defaultValue={data.head_office} />
              </EditField>
              <EditField label="Relationship started">
                <Input name="relationship_started_at" type="date" defaultValue={data.relationship_started_at || ""} />
              </EditField>
              <EditField label="Status">
                <select
                  name="status"
                  defaultValue={data.status}
                  className="text-xs h-9 rounded-md border border-subtle bg-surface-1 px-3 text-primary"
                >
                  <option value="lead">Lead</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </EditField>
              <label className="text-[11px] text-secondary sm:col-span-2">
                Notes
                <textarea
                  name="notes"
                  rows={4}
                  defaultValue={data.notes}
                  className="text-xs mt-1 w-full rounded-md border border-subtle bg-surface-1 p-3 text-primary"
                />
              </label>
              {formError ? <p className="text-xs text-danger-primary sm:col-span-2">{formError}</p> : null}
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button type="button" variant="neutral-primary" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={saving}>
                  Save changes
                </Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function ClientMetric(props: { icon: React.ReactNode; label: string; value: React.ReactNode; detail: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3 border-subtle p-5 sm:border-r lg:last:border-r-0 sm:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-subtle text-accent-primary">
        {props.icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-secondary">{props.label}</p>
        <p className="text-lg mt-1.5 truncate font-semibold text-primary">{props.value}</p>
        <p className="mt-2 truncate text-[9px] font-medium text-accent-primary">{props.detail} →</p>
      </div>
    </div>
  );
}

function DataSection(props: { title: string; action: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-subtle bg-surface-1">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <h2 className="text-xs font-semibold text-primary">{props.title}</h2>
        {props.href ? (
          <Link
            href={props.href}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-accent-primary"
          >
            {props.action} <ArrowRight className="size-3" />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-accent-primary">
            {props.action} <ArrowRight className="size-3" />
          </span>
        )}
      </div>
      {props.children}
    </section>
  );
}

function SideCard(props: { title: string; action?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-subtle bg-surface-1 p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold text-primary">{props.title}</h2>
        {props.action ? <span className="text-[10px] font-medium text-accent-primary">{props.action} →</span> : null}
      </div>
      {props.children}
    </section>
  );
}

function HealthRow(props: { label: string; detail: string }) {
  return (
    <div className="flex gap-2">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-primary" />
      <div>
        <p className="text-[10px] font-medium text-primary">{props.label}</p>
        <p className="mt-0.5 text-[9px] text-secondary">{props.detail}</p>
      </div>
    </div>
  );
}

function Detail(props: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 text-[10px]">
      <dt className="text-secondary">{props.label}</dt>
      <dd className="font-medium text-primary">{props.value}</dd>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-md bg-accent-subtle px-2 py-1 font-medium text-accent-primary">
      {children}
    </span>
  );
}

function EditField(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-[11px] text-secondary">
      {props.label}
      <span className="mt-1 block">{props.children}</span>
    </label>
  );
}
