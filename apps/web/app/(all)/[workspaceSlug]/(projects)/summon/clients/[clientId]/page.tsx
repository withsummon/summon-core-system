/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { useOutletContext } from "react-router";
import { useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import { Controller } from "react-hook-form";
import { api } from "@summon/convex/api";
import type { FunctionReturnType } from "convex/server";
import type { Doc, Id } from "@summon/convex/data-model";
import { memberLabel } from "@summon/convex/member-label";
import { generateWorkItemLink } from "@plane/utils";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { ClientForm } from "@/components/convex-core/commercial/client-form";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  FolderKanban,
  Mail,
  Pencil,
  Phone,
  Plus,
  Target,
} from "lucide-react";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/ui";
import { PageHead } from "@/components/core/page-title";
import { SummonRequestState } from "@/components/summon/request-state";
import type { Route } from "./+types/page";
import { Select } from "@plane/propel/select";
import { DatePicker } from "@plane/propel/date-picker";

const formatDate = (value?: string | number | null) => {
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
  const { workspace } = useOutletContext<WorkspaceSession>();
  const context = useQuery(api.commercial.clients.get, { workspaceId: workspace._id, clientId: params.clientId });
  if (!context) return <SummonRequestState loading />;
  if (!context.record) throw new Error("Client detail requires an existing client.");
  return <ClientDetail key={context.record._id} workspace={workspace} context={context} data={context.record} />;
}

function ClientDetail({
  workspace,
  context,
  data,
}: {
  workspace: WorkspaceSession["workspace"];
  context: FunctionReturnType<typeof api.commercial.clients.get>;
  data: Doc<"clients">;
}) {
  const workspaceSlug = workspace.slug;
  const [activeTab, setActiveTab] = useState<TClientTab>("overview");
  const [editing, setEditing] = useState(false);
  const owner = context.owner ? memberLabel(context.owner) : "Not assigned";
  const information = [
    { label: "Legal Name", value: data.companyName },
    { label: "Industry", value: data.industry },
    { label: "Head Office", value: data.headOffice },
    { label: "Account Manager", value: owner },
  ];
  const showTab = (tab: TClientTab) => activeTab === "overview" || activeTab === tab;

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
              <span>Since {formatDate(data.relationshipStartedAt)}</span>
              <span>•</span>
              <span>{data.industry || "Industry not set"}</span>
            </div>
            <p className="text-xs mt-2 max-w-3xl leading-5 text-secondary">
              {data.notes || "No client relationship notes yet."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {context.canWrite && (
            <Link
              href={`/${workspaceSlug}/summon/opportunities/?${new URLSearchParams({ create: "1", client: data._id })}`}
              className="text-xs inline-flex h-10 items-center gap-2 rounded-xl border border-subtle bg-surface-1 px-4 font-medium text-primary hover:bg-layer-1"
            >
              <Plus className="size-3.5" /> New opportunity
            </Link>
          )}
          <button
            type="button"
            disabled={!context.canWrite}
            onClick={() => setEditing(true)}
            className="text-xs inline-flex h-10 items-center gap-2 rounded-xl bg-accent-primary px-5 font-medium text-white"
          >
            <Pencil className="size-3.5" /> Edit Client
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
          {activeTab === "overview" ? <ClientMetrics workspace={workspace} clientId={data._id} /> : null}

          {showTab("opportunities") ? (
            <ClientOpportunities workspace={workspace} clientId={data._id} currency={context.currency} />
          ) : null}

          {showTab("projects") ? (
            <ClientProjects workspace={workspace} clientId={data._id} overview={activeTab === "overview"} />
          ) : null}

          {showTab("contacts") ? (
            <ClientContacts
              workspace={workspace}
              clientId={data._id}
              onSelect={() => setActiveTab("contacts")}
              overview={activeTab === "overview"}
            />
          ) : null}

          {showTab("activity") ? (
            <ClientActivity
              workspace={workspace}
              clientId={data._id}
              onSelect={() => setActiveTab("activity")}
              overview={activeTab === "overview"}
            />
          ) : null}

          {activeTab === "documents" || activeTab === "notes" ? (
            <ClientDocuments workspace={workspace} clientId={data._id} tab={activeTab} />
          ) : null}

          {activeTab === "settings" ? (
            <DataSection title="Client Settings" action="Manage client record">
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                {information.map(({ label, value }) => (
                  <Detail key={label} label={label} value={value || "Not set"} />
                ))}

                <div className="sm:col-span-2">
                  <Button size="xl" type="button" disabled={!context.canWrite} onClick={() => setEditing(true)}>
                    <Pencil className="mr-2 size-3.5" /> Edit Client
                  </Button>
                </div>
              </div>
            </DataSection>
          ) : null}
        </main>

        {activeTab === "overview" ? (
          <aside className="min-w-0 space-y-4">
            <ClientHealth workspace={workspace} clientId={data._id} />

            <SideCard title="Client Information">
              <dl className="space-y-4">
                {information.map(({ label, value }) => (
                  <Detail key={label} label={label} value={value || "Not set"} />
                ))}

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

                <Detail label="Client Since" value={formatDate(data.relationshipStartedAt)} />
              </dl>
            </SideCard>

            <ClientNotes workspace={workspace} clientId={data._id} onSelect={() => setActiveTab("notes")} />
          </aside>
        ) : null}
      </div>

      {editing && (
        <ClientForm
          workspaceId={workspace._id}
          context={context}
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
          className="mt-5 grid gap-3 sm:grid-cols-2"
        >
          {({ register, control, formState: { isSubmitting } }) => (
            <>
              <EditField label="Client name">
                <Input {...register("name")} required maxLength={255} />
              </EditField>
              <EditField label="Legal name">
                <Input {...register("companyName")} maxLength={255} />
              </EditField>
              <EditField label="Industry">
                <Input {...register("industry")} maxLength={120} />
              </EditField>
              <EditField label="Website">
                <Input {...register("website")} type="url" maxLength={200} />
              </EditField>
              <EditField label="Head office">
                <Input {...register("headOffice")} maxLength={255} />
              </EditField>
              <EditField label="Relationship started">
                <Controller
                  name="relationshipStartedAt"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      name={field.name}
                      value={field.value ?? ""}
                      onValueChange={(value) => field.onChange(value || null)}
                      disabled={isSubmitting || !context.canWrite}
                    />
                  )}
                />
              </EditField>
              <EditField label="Status">
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select
                      name={field.name}
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isSubmitting || !context.canWrite}
                      options={context.statuses.map((value) => ({ value, label: statusLabel(value) }))}
                    />
                  )}
                />
              </EditField>
              <label className="text-[11px] text-secondary sm:col-span-2">
                Notes
                <textarea
                  {...register("notes")}
                  rows={4}
                  maxLength={100000}
                  className="text-xs mt-1 w-full rounded-md border border-subtle bg-surface-1 p-3 text-primary"
                />
              </label>
            </>
          )}
        </ClientForm>
      )}
    </section>
  );
}

function ClientMetrics({ workspace, clientId }: { workspace: WorkspaceSession["workspace"]; clientId: Id<"clients"> }) {
  const opportunities = usePaginatedQuery(
    api.commercial.clients.related,
    { workspaceId: workspace._id, scope: { clientId }, kind: "opportunityCounts" },
    { initialNumItems: 100 }
  );
  const projects = usePaginatedQuery(
    api.commercial.clients.related,
    { workspaceId: workspace._id, scope: { clientId }, kind: "projectCounts" },
    { initialNumItems: 100 }
  );
  const activity = usePaginatedQuery(
    api.commercial.clients.related,
    { workspaceId: workspace._id, scope: { clientId }, kind: "activity" },
    { initialNumItems: 1 }
  );
  const { status: opportunityStatus, loadMore: moreOpportunities } = opportunities;
  const { status: projectStatus, loadMore: moreProjects } = projects;
  const { status: activityStatus, loadMore: moreActivity, results: recentActivity } = activity;
  useEffect(() => {
    if (opportunityStatus === "CanLoadMore") moreOpportunities(100);
    if (projectStatus === "CanLoadMore") moreProjects(100);
    if (activityStatus === "CanLoadMore" && !recentActivity.length) moreActivity(1);
  }, [
    opportunityStatus,
    moreOpportunities,
    projectStatus,
    moreProjects,
    activityStatus,
    moreActivity,
    recentActivity.length,
  ]);
  const active = opportunities.results
    .filter((row) => row.kind === "count")
    .reduce((total, row) => total + row.active, 0);
  const total = projects.results.filter((row) => row.kind === "count").reduce((sum, row) => sum + row.total, 0);
  const latest = activity.results.find((row) => row.kind === "activity");
  return (
    <section className="grid overflow-hidden rounded-xl border border-subtle bg-surface-1 sm:grid-cols-2 lg:grid-cols-4">
      <ClientMetric
        icon={<Target className="size-4.5" />}
        label="Active Opportunities"
        value={opportunities.status === "Exhausted" ? active : "—"}
        detail="View opportunities"
      />
      <ClientMetric
        icon={<FolderKanban className="size-4.5" />}
        label="Active Projects"
        value={projects.status === "Exhausted" ? total : "—"}
        detail="View projects"
      />
      <ClientMetric
        icon={<Building2 className="size-4.5" />}
        label="Total Projects"
        value={projects.status === "Exhausted" ? total : "—"}
        detail="Visible Plane projects"
      />
      <ClientMetric
        icon={<CalendarDays className="size-4.5" />}
        label="Last Interaction"
        value={latest ? formatDate(latest.event._creationTime) : activity.status === "Exhausted" ? "No activity" : "—"}
        detail={latest ? latest.task.title : "Recent delivery activity"}
      />
    </section>
  );
}
function ClientHealth({ workspace, clientId }: { workspace: WorkspaceSession["workspace"]; clientId: Id<"clients"> }) {
  const projects = usePaginatedQuery(
    api.commercial.clients.related,
    { workspaceId: workspace._id, scope: { clientId }, kind: "projectCounts" },
    { initialNumItems: 100 }
  );
  const contacts = usePaginatedQuery(
    api.commercial.clients.related,
    { workspaceId: workspace._id, scope: { clientId }, kind: "contactCounts" },
    { initialNumItems: 100 }
  );
  const meetings = usePaginatedQuery(
    api.commercial.clients.related,
    { workspaceId: workspace._id, scope: { clientId }, kind: "meetingCounts" },
    { initialNumItems: 100 }
  );
  const { status: projectStatus, loadMore: moreProjects } = projects;
  const { status: contactStatus, loadMore: moreContacts } = contacts;
  const { status: meetingStatus, loadMore: moreMeetings } = meetings;
  useEffect(() => {
    if (projectStatus === "CanLoadMore") moreProjects(100);
    if (contactStatus === "CanLoadMore") moreContacts(100);
    if (meetingStatus === "CanLoadMore") moreMeetings(100);
  }, [projectStatus, moreProjects, contactStatus, moreContacts, meetingStatus, moreMeetings]);
  return (
    <SideCard title="Relationship Health">
      <span className="inline-flex rounded-full bg-layer-2 px-2 py-1 text-[10px] font-medium text-secondary">
        Not scored
      </span>
      <p className="mt-2 text-[10px] leading-4 text-secondary">No relationship-health data source is configured.</p>
      <div className="mt-4 space-y-3">
        {[
          { label: "Communication records", query: meetings, unit: "meetings linked" },
          { label: "Projects tracked", query: projects, unit: "visible projects" },
          { label: "Client contacts", query: contacts, unit: "contacts recorded" },
        ].map(({ label, query, unit }) => (
          <HealthRow
            key={label}
            label={label}
            detail={
              query.status === "Exhausted"
                ? `${query.results.filter((row) => row.kind === "count").reduce((total, row) => total + row.total, 0)} ${unit}`
                : "Loading…"
            }
          />
        ))}
      </div>
    </SideCard>
  );
}
function ClientNotes({
  workspace,
  clientId,
  onSelect,
}: {
  workspace: WorkspaceSession["workspace"];
  clientId: Id<"clients">;
  onSelect: () => void;
}) {
  const documentPages = usePaginatedQuery(
    api.commercial.clients.related,
    { workspaceId: workspace._id, scope: { clientId }, kind: "notes" },
    { initialNumItems: 3 }
  );
  const documents = documentPages.results.filter((row) => row.kind === "document").map((row) => row.document);
  return (
    <SideCard title="Notes" action="View all notes" onAction={onSelect}>
      <div className="space-y-2">
        {documents.slice(0, 3).map((document) => (
          <div key={document._id} className="flex min-w-0 gap-3 rounded-lg border border-subtle p-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-subtle text-accent-primary">
              <FileText className="size-3.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold text-primary">{document.name || "Untitled page"}</p>
              <p className="mt-1 text-[9px] text-secondary">{formatDate(document.updatedAt)}</p>
            </div>
          </div>
        ))}
        {documentPages.status === "Exhausted" && !documents.length ? (
          <p className="py-4 text-[10px] text-tertiary">No linked notes.</p>
        ) : null}
      </div>
    </SideCard>
  );
}

function ClientOpportunities({
  workspace,
  clientId,
  currency,
}: {
  workspace: WorkspaceSession["workspace"];
  clientId: Id<"clients">;
  currency: string;
}) {
  const workspaceSlug = workspace.slug;
  const opportunityPages = usePaginatedQuery(
    api.commercial.clients.related,
    { workspaceId: workspace._id, scope: { clientId }, kind: "opportunities" },
    { initialNumItems: 20 }
  );
  const opportunities = opportunityPages.results.filter((row) => row.kind === "opportunity");
  return (
    <DataSection
      title="Opportunities"
      query={opportunityPages}
      action="View all opportunities"
      href={`/${workspaceSlug}/summon/opportunities/`}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[10px]">
          <thead className="border-y border-subtle bg-layer-1/40 text-secondary">
            <tr>
              {["Opportunity", "Stage", "Owner", `Value (${currency})`, "Close Date", "Progress"].map((label) => (
                <th key={label} className="px-4 py-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {opportunities.map(({ opportunity, owner: opportunityOwner }) => {
              return (
                <tr key={opportunity._id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/${workspaceSlug}/summon/opportunities/${opportunity._id}/`}
                      className="font-semibold text-primary"
                    >
                      {opportunity.title}
                    </Link>
                    <p className="mt-1 text-tertiary">{opportunity.product || "Product not set"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge>{statusLabel(opportunity.stage)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-primary">
                    {opportunityOwner ? memberLabel(opportunityOwner) : "Not assigned"}
                  </td>
                  <td className="px-4 py-3 text-primary">{opportunity.value || "—"}</td>
                  <td className="px-4 py-3 text-primary">{formatDate(opportunity.expectedCloseDate)}</td>
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
            {opportunityPages.status === "Exhausted" && !opportunities.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-tertiary">
                  No opportunities linked to this client.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </DataSection>
  );
}

function ClientProjects({
  workspace,
  clientId,
  overview,
}: {
  workspace: WorkspaceSession["workspace"];
  clientId: Id<"clients">;
  overview: boolean;
}) {
  const workspaceSlug = workspace.slug;
  const projectPages = usePaginatedQuery(
    api.commercial.clients.related,
    { workspaceId: workspace._id, scope: { clientId }, kind: "projects" },
    { initialNumItems: 20 }
  );
  const projects = projectPages.results.filter((row) => row.kind === "project").map((row) => row.project);
  return (
    <DataSection
      title="Recent Projects"
      query={projectPages}
      preview={overview}
      action="View all projects"
      href={`/${workspaceSlug}/projects/`}
    >
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
            {projects.slice(0, overview ? 5 : undefined).map((project) => (
              <tr key={project._id}>
                <td className="px-4 py-3">
                  <Link
                    href={`/${workspaceSlug}/projects/${project._id}/issues/`}
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
            {projectPages.status === "Exhausted" && !projects.length ? (
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
  );
}

function ClientContacts({
  workspace,
  clientId,
  overview,
  onSelect,
}: {
  workspace: WorkspaceSession["workspace"];
  clientId: Id<"clients">;
  overview: boolean;
  onSelect: () => void;
}) {
  const contactPages = usePaginatedQuery(
    api.commercial.clients.related,
    { workspaceId: workspace._id, scope: { clientId }, kind: "contacts" },
    { initialNumItems: 20 }
  );
  const contacts = contactPages.results.filter((row) => row.kind === "contact").map((row) => row.contact);
  return (
    <DataSection
      title="Key Contacts"
      query={contactPages}
      preview={overview}
      action="View all contacts"
      onAction={onSelect}
    >
      <div className="grid gap-3 p-4 md:grid-cols-2 2xl:grid-cols-3">
        {contacts.slice(0, overview ? 3 : undefined).map((contact) => (
          <article key={contact._id} className="flex min-w-0 gap-3 rounded-xl border border-subtle p-3">
            <span className="text-sm grid size-11 shrink-0 place-items-center rounded-full bg-accent-subtle font-semibold text-accent-primary">
              {contact.name.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-[11px] font-semibold text-primary">{contact.name}</h3>
              <p className="mt-0.5 truncate text-[10px] text-secondary">{contact.title || "Role not set"}</p>
              {contact.email ? (
                <a href={`mailto:${contact.email}`} className="mt-1 block truncate text-[10px] text-accent-primary">
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
        {contactPages.status === "Exhausted" && !contacts.length ? (
          <p className="py-8 text-center text-[10px] text-tertiary md:col-span-2 2xl:col-span-3">No contacts added.</p>
        ) : null}
      </div>
    </DataSection>
  );
}

function ClientActivity({
  workspace,
  clientId,
  overview,
  onSelect,
}: {
  workspace: WorkspaceSession["workspace"];
  clientId: Id<"clients">;
  overview: boolean;
  onSelect: () => void;
}) {
  const workspaceSlug = workspace.slug;
  const activityPages = usePaginatedQuery(
    api.commercial.clients.related,
    { workspaceId: workspace._id, scope: { clientId }, kind: "activity" },
    { initialNumItems: 20 }
  );
  const activities = activityPages.results.filter((row) => row.kind === "activity");
  return (
    <DataSection
      title="Recent Activity"
      query={activityPages}
      preview={overview}
      action="View all activity"
      onAction={onSelect}
    >
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {activities.slice(0, overview ? 5 : undefined).map((activity) => (
          <Link
            key={activity.event._id}
            href={generateWorkItemLink({
              workspaceSlug,
              projectId: activity.project._id,
              issueId: activity.task._id,
              projectIdentifier: activity.project.identifier,
              sequenceId: activity.task.sequence,
              isArchived: activity.task.archivedAt !== null,
            })}
            className="flex min-w-0 items-start gap-3"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-subtle text-accent-primary">
              <FileText className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[10px] font-semibold text-primary">{`${activity.task.title}: ${activity.event.kind.replaceAll("_", " ")}`}</span>
              <time
                className="mt-1 block text-[9px] text-secondary"
                dateTime={new Date(activity.event._creationTime).toISOString()}
              >
                {formatDate(activity.event._creationTime)}
              </time>
            </span>
          </Link>
        ))}
        {activityPages.status === "Exhausted" && !activities.length ? (
          <p className="text-[10px] text-tertiary">No recent activity.</p>
        ) : null}
      </div>
    </DataSection>
  );
}

function ClientDocuments({
  workspace,
  clientId,
  tab,
}: {
  workspace: WorkspaceSession["workspace"];
  clientId: Id<"clients">;
  tab: TClientTab;
}) {
  const documentPages = usePaginatedQuery(
    api.commercial.clients.related,
    { workspaceId: workspace._id, scope: { clientId }, kind: tab === "documents" ? "documents" : "notes" },
    { initialNumItems: 20 }
  );
  const documents = documentPages.results.filter((row) => row.kind === "document").map((row) => row.document);
  return (
    <DataSection
      title={tab === "documents" ? "Documents" : "Notes"}
      query={documentPages}
      action={documentPages.status === "Exhausted" ? `${documents.length} linked pages` : "Linked pages"}
    >
      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {documents.map((document) => (
          <article key={document._id} className="flex min-w-0 gap-3 rounded-xl border border-subtle p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-subtle text-accent-primary">
              <FileText className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold text-primary">{document.name || "Untitled page"}</p>
              <p className="mt-1 text-[9px] text-secondary">
                {statusLabel(document.category || "page")} · {formatDate(document.updatedAt)}
              </p>
            </div>
          </article>
        ))}
        {documentPages.status === "Exhausted" && !documents.length ? (
          <p className="py-8 text-center text-[10px] text-tertiary sm:col-span-2 xl:col-span-3">No linked {tab}.</p>
        ) : null}
      </div>
    </DataSection>
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

function DataSection(props: {
  title: string;
  action: string;
  href?: string;
  onAction?: () => void;
  children: React.ReactNode;
  query?: ReturnType<typeof usePaginatedQuery<typeof api.commercial.clients.related>>;
  preview?: boolean;
}) {
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
        ) : props.onAction ? (
          <button
            type="button"
            onClick={props.onAction}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-accent-primary"
          >
            {props.action} <ArrowRight className="size-3" />
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-accent-primary">
            {props.action} <ArrowRight className="size-3" />
          </span>
        )}
      </div>
      {props.children}
      {props.query?.status === "LoadingFirstPage" || props.query?.status === "LoadingMore" ? (
        <p role="status" className="text-xs p-4 text-secondary">
          Loading linked records…
        </p>
      ) : null}
      {!props.preview && props.query?.status === "CanLoadMore" && (
        <div className="border-t border-subtle p-3">
          <Button variant="secondary" onClick={() => props.query?.loadMore(20)}>
            Load more
          </Button>
        </div>
      )}
    </section>
  );
}

function SideCard(props: { title: string; action?: string; onAction?: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-subtle bg-surface-1 p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold text-primary">{props.title}</h2>
        {props.action && (
          <button type="button" onClick={props.onAction} className="text-[10px] font-medium text-accent-primary">
            {props.action} →
          </button>
        )}
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
