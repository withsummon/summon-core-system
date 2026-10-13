/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  FileText,
  FolderKanban,
  Mail,
  Pencil,
  Phone,
  Target,
} from "lucide-react";
import { Button } from "@plane/propel/button";
import type { ISummonClientDetail, IUserLite } from "@plane/types";
import { capitalizeFirstLetter, replaceUnderscoreIfSnakeCase } from "@plane/utils";
import { SummonPanel } from "@/components/summon/screen";
import { Badge, ClientMetric, Detail, formatDate } from "./client-detail-shared";
import type { TPanelLink } from "./client-detail-shared";

/** Column labels: the desktop header and the phone row label read from the same entry. */
const DEAL_COLUMNS = {
  opportunity: "Opportunity",
  stage: "Stage",
  owner: "Owner",
  value: "Value (IDR)",
  closeDate: "Close Date",
  progress: "Progress",
} as const;

const PROJECT_COLUMNS = {
  project: "Project",
  type: "Type",
  status: "Status",
  owner: "Owner",
  startDate: "Start Date",
  endDate: "End Date",
} as const;

type TClientOpportunity = NonNullable<ISummonClientDetail["opportunities"]>[number];

export function ClientOverviewMetrics(props: { data: ISummonClientDetail }) {
  const { data } = props;
  const deals = data.opportunities;
  const lastInteraction = data.recent_activity[0];
  return (
    <section
      className={`grid overflow-hidden rounded-xl border border-subtle bg-surface-1 sm:grid-cols-2 ${deals ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
    >
      {deals ? (
        <ClientMetric
          icon={<Target className="size-4.5" />}
          label="Active Opportunities"
          value={deals.filter(({ stage }) => stage !== "won" && stage !== "lost").length}
          detail="View opportunities"
        />
      ) : null}
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
        detail="Projects you can see"
      />
      <ClientMetric
        icon={<CalendarDays className="size-4.5" />}
        label="Last Interaction"
        value={lastInteraction ? formatDate(lastInteraction.created_at) : "No activity"}
        detail={lastInteraction?.label || "Nothing recorded"}
      />
    </section>
  );
}

export function ClientOpportunitiesPanel(props: {
  workspaceSlug: string;
  deals: TClientOpportunity[];
  link: TPanelLink;
  money: (value: string | null | undefined) => string;
  getUserDetails: (userId: string) => IUserLite | undefined;
}) {
  const { workspaceSlug, deals, link, money, getUserDetails } = props;
  return (
    <SummonPanel flush title="Opportunities" link={link}>
      <div className="overflow-x-auto">
        <table className="table-stack w-full text-left text-12 md:min-w-[720px]">
          <thead className="border-y border-subtle bg-layer-1/40 text-secondary">
            <tr>
              {Object.values(DEAL_COLUMNS).map((label) => (
                <th key={label} className="px-4 py-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {deals.map((opportunity) => {
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
                  <td data-label={DEAL_COLUMNS.stage} className="px-4 py-3">
                    <Badge>{capitalizeFirstLetter(replaceUnderscoreIfSnakeCase(opportunity.stage))}</Badge>
                  </td>
                  <td data-label={DEAL_COLUMNS.owner} className="px-4 py-3 text-primary">
                    {opportunityOwner?.display_name || "Not assigned"}
                  </td>
                  <td data-label={DEAL_COLUMNS.value} className="px-4 py-3 text-primary tabular-nums">
                    {money(opportunity.value) || "—"}
                  </td>
                  <td data-label={DEAL_COLUMNS.closeDate} className="px-4 py-3 text-primary">
                    {formatDate(opportunity.expected_close_date)}
                  </td>
                  <td data-label={DEAL_COLUMNS.progress} className="px-4 py-3">
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
            {!deals.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-tertiary">
                  No opportunities linked to this client.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </SummonPanel>
  );
}

export function ClientProjectsPanel(props: {
  workspaceSlug: string;
  projects: ISummonClientDetail["projects"];
  link: TPanelLink;
}) {
  const { workspaceSlug, projects, link } = props;
  return (
    <SummonPanel flush title="Recent Projects" link={link}>
      <div className="overflow-x-auto">
        <table className="table-stack w-full text-left text-12 md:min-w-[680px]">
          <thead className="border-y border-subtle bg-layer-1/40 text-secondary">
            <tr>
              {Object.values(PROJECT_COLUMNS).map((label) => (
                <th key={label} className="px-4 py-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {projects.slice(0, 5).map((project) => (
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
                <td data-label={PROJECT_COLUMNS.type} className="px-4 py-3">
                  <Badge>Project</Badge>
                </td>
                <td data-label={PROJECT_COLUMNS.status} className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-subtle px-2 py-1 text-success-primary">
                    <CheckCircle2 className="size-3" /> Linked
                  </span>
                </td>
                <td data-label={PROJECT_COLUMNS.owner} className="px-4 py-3 text-tertiary">
                  Not available
                </td>
                <td data-label={PROJECT_COLUMNS.startDate} className="px-4 py-3 text-tertiary">
                  Not available
                </td>
                <td data-label={PROJECT_COLUMNS.endDate} className="px-4 py-3 text-tertiary">
                  Not available
                </td>
              </tr>
            ))}
            {!projects.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-tertiary">
                  No visible Plane projects linked to this client.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </SummonPanel>
  );
}

export function ClientContactsPanel(props: { contacts: ISummonClientDetail["contacts"]; link: TPanelLink }) {
  const { contacts, link } = props;
  return (
    <SummonPanel flush title="Key Contacts" link={link}>
      <div className="grid gap-3 p-4 md:grid-cols-2 2xl:grid-cols-3">
        {contacts.slice(0, 3).map((contact) => (
          <article key={contact.id} className="flex min-w-0 gap-3 rounded-xl border border-subtle p-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-subtle text-sm font-semibold text-accent-primary">
              {contact.name.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-12 font-semibold text-primary" title={contact.name}>
                {contact.name}
              </h3>
              <p className="mt-0.5 truncate text-12 text-secondary">{contact.title || "Role not set"}</p>
              {contact.email ? (
                <a href={`mailto:${contact.email}`} className="mt-1 block truncate text-12 text-accent-primary">
                  {contact.email}
                </a>
              ) : null}
              {contact.phone ? (
                <a href={`tel:${contact.phone}`} className="mt-1 block truncate text-12 text-secondary">
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
        {!contacts.length ? (
          <p className="py-8 text-center text-12 text-tertiary md:col-span-2 2xl:col-span-3">No contacts added.</p>
        ) : null}
      </div>
    </SummonPanel>
  );
}

export function ClientActivityPanel(props: { activity: ISummonClientDetail["recent_activity"]; link: TPanelLink }) {
  const { activity, link } = props;
  return (
    <SummonPanel flush title="Recent Activity" link={link}>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {activity.slice(0, 5).map((item) => (
          <Link key={item.id} href={item.href} className="flex min-w-0 items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-subtle text-accent-primary">
              <FileText className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-12 font-semibold text-primary">{item.label}</span>
              <time className="mt-1 block text-12 text-secondary" dateTime={item.created_at}>
                {formatDate(item.created_at)}
              </time>
            </span>
          </Link>
        ))}
        {!activity.length ? <p className="text-12 text-tertiary">No recent activity.</p> : null}
      </div>
    </SummonPanel>
  );
}

export function ClientPagesPanel(props: {
  kind: "documents" | "notes";
  pageContexts: ISummonClientDetail["page_contexts"];
}) {
  const { kind, pageContexts } = props;
  const visiblePageContexts = pageContexts.filter((context) =>
    kind === "documents" ? context.category === "document" : context.category !== "document"
  );
  return (
    <SummonPanel flush title={kind === "documents" ? "Documents" : "Notes"} count={visiblePageContexts.length}>
      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {visiblePageContexts.map((context) => (
          <article key={context.id} className="flex min-w-0 gap-3 rounded-xl border border-subtle p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-subtle text-accent-primary">
              <FileText className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-12 font-semibold text-primary">
                {context.page_detail.name || "Untitled page"}
              </p>
              <p className="mt-1 text-12 text-secondary">
                {capitalizeFirstLetter(replaceUnderscoreIfSnakeCase(context.category || "page"))} ·{" "}
                {formatDate(context.updated_at)}
              </p>
            </div>
          </article>
        ))}
        {!visiblePageContexts.length ? (
          <p className="py-8 text-center text-12 text-tertiary sm:col-span-2 xl:col-span-3">No linked {kind}.</p>
        ) : null}
      </div>
    </SummonPanel>
  );
}

export function ClientSettingsPanel(props: {
  data: ISummonClientDetail;
  ownerName: string | undefined;
  onEdit: () => void;
}) {
  const { data, ownerName, onEdit } = props;
  return (
    <SummonPanel flush title="Client Settings">
      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <Detail label="Legal Name" value={data.company_name || "Not set"} />
        <Detail label="Industry" value={data.industry || "Not set"} />
        <Detail label="Head Office" value={data.head_office || "Not set"} />
        <Detail label="Account Manager" value={ownerName || "Not assigned"} />
        <div className="sm:col-span-2">
          <Button size="xl" type="button" onClick={onEdit}>
            <Pencil className="mr-2 size-3.5" /> Edit Client
          </Button>
        </div>
      </div>
    </SummonPanel>
  );
}
