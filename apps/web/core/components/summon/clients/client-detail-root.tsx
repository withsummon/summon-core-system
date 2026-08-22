/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import Link from "next/link";
import {
  Building2,
  MoreHorizontal,
  Edit,
  ArrowRight,
  ExternalLink,
  Mail,
  Phone,
  MessageSquare,
  FileText,
  Upload,
  Calendar,
  Info,
  ChevronRight,
  User,
  Plus,
} from "lucide-react";
import { PEGADAIAN_CLIENT, ALL_CLIENTS_DIRECTORY } from "./mock-data";
import { AddClientModal } from "./add-client-modal";
import type { TClientTab, IClientDetail } from "./types";

interface IClientDetailRootProps {
  clientId?: string;
  workspaceSlug?: string;
}

const TABS: TClientTab[] = [
  "Overview",
  "Opportunities",
  "Projects",
  "Contacts",
  "Documents",
  "Activity",
  "Notes",
  "Settings",
];

export function ClientDetailRoot({ clientId, workspaceSlug }: IClientDetailRootProps) {
  const [activeTab, setActiveTab] = useState<TClientTab>("Overview");
  const [showEditModal, setShowEditModal] = useState(false);

  // Find client from directory or fallback to Pegadaian
  const client: IClientDetail = ALL_CLIENTS_DIRECTORY.find((c) => c.id === clientId) || PEGADAIAN_CLIENT;

  const clientsListHref = workspaceSlug ? `/${workspaceSlug}/summon/clients` : "/summon/clients";

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      {/* Breadcrumbs */}
      <div className="text-xs flex items-center gap-2 font-medium text-secondary">
        <Link href={clientsListHref} className="hover:text-primary hover:underline">
          Clients
        </Link>
        <ChevronRight className="size-3 text-tertiary" />
        <span className="font-semibold text-primary">{client.name}</span>
      </div>

      {/* Header Profile Card */}
      <div className="shadow-sm rounded-2xl border border-subtle bg-surface-1 p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div className="flex items-start gap-4">
            {/* Client Logo Avatar */}
            <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex size-14 shrink-0 items-center justify-center rounded-2xl">
              <Building2 className="size-8" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-primary">{client.name}</h1>
                <span className="bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400 rounded-full px-2.5 py-0.5 font-semibold">
                  {client.status}
                </span>
                <span className="text-xs font-medium text-tertiary">• Since {client.since}</span>
                <span className="text-xs font-medium text-tertiary">• {client.industry}</span>
              </div>

              <p className="text-xs mt-2 max-w-3xl leading-relaxed text-secondary">{client.description}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex size-8.5 items-center justify-center rounded-xl border border-subtle bg-surface-1 text-secondary hover:bg-layer-1 hover:text-primary"
            >
              <MoreHorizontal className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              className="text-xs shadow-sm flex items-center gap-1.5 rounded-xl border border-subtle bg-surface-1 px-3.5 py-1.5 font-semibold text-primary hover:bg-layer-1"
            >
              <Edit className="size-3.5" />
              Edit Client
            </button>
            <button
              type="button"
              className="shadow-sm flex size-8.5 items-center justify-center rounded-xl bg-accent-primary text-white hover:bg-accent-primary/90"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>

        {/* Sub-tabs Navigation */}
        <div className="mt-6 flex overflow-x-auto border-t border-subtle pt-4">
          <div className="flex gap-6">
            {TABS.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`text-xs font-semibold transition-all ${
                    isActive
                      ? "border-accent-primary border-b-2 pb-2 font-bold text-primary"
                      : "pb-2 text-secondary hover:text-primary"
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4 Quick KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Active Opportunities */}
        <div className="shadow-sm flex flex-col justify-between rounded-2xl border border-subtle bg-surface-1 p-4">
          <span className="text-xs font-medium text-secondary">Active Opportunities</span>
          <div className="text-2xl mt-2 font-bold text-primary">{client.kpis.activeOpportunities}</div>
          <button
            type="button"
            onClick={() => setActiveTab("Opportunities")}
            className="text-xs mt-2 inline-flex items-center gap-1 font-medium text-accent-primary hover:underline"
          >
            View opportunities <ArrowRight className="size-3" />
          </button>
        </div>

        {/* Active Projects */}
        <div className="shadow-sm flex flex-col justify-between rounded-2xl border border-subtle bg-surface-1 p-4">
          <span className="text-xs font-medium text-secondary">Active Projects</span>
          <div className="text-2xl mt-2 font-bold text-primary">{client.kpis.activeProjects}</div>
          <button
            type="button"
            onClick={() => setActiveTab("Projects")}
            className="text-xs mt-2 inline-flex items-center gap-1 font-medium text-accent-primary hover:underline"
          >
            View projects <ArrowRight className="size-3" />
          </button>
        </div>

        {/* Total Projects */}
        <div className="shadow-sm flex flex-col justify-between rounded-2xl border border-subtle bg-surface-1 p-4">
          <span className="text-xs font-medium text-secondary">Total Projects</span>
          <div className="text-2xl mt-2 font-bold text-primary">{client.kpis.totalProjects}</div>
          <button
            type="button"
            onClick={() => setActiveTab("Projects")}
            className="text-xs mt-2 inline-flex items-center gap-1 font-medium text-accent-primary hover:underline"
          >
            View all projects <ArrowRight className="size-3" />
          </button>
        </div>

        {/* Last Interaction */}
        <div className="shadow-sm flex flex-col justify-between rounded-2xl border border-subtle bg-surface-1 p-4">
          <span className="text-xs font-medium text-secondary">Last Interaction</span>
          <div className="text-2xl mt-2 font-bold text-primary">{client.kpis.lastInteraction}</div>
          <span className="text-xs mt-2 font-medium text-secondary">{client.kpis.lastInteractionDetail}</span>
        </div>
      </div>

      {/* Main Content Layout (2 Columns) */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left Column */}
        <div className="flex flex-col gap-6">
          {/* Active Opportunities Card */}
          <div className="shadow-sm rounded-2xl border border-subtle bg-surface-1 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-primary">Active Opportunities</h2>
              <button
                type="button"
                onClick={() => setActiveTab("Opportunities")}
                className="text-xs inline-flex items-center gap-1 font-medium text-accent-primary hover:underline"
              >
                View all opportunities <ArrowRight className="size-3" />
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="text-xs w-full text-left">
                <thead>
                  <tr className="border-b border-subtle text-[11px] font-semibold text-tertiary uppercase">
                    <th className="pb-2 font-medium">Opportunity</th>
                    <th className="pb-2 font-medium">Stage</th>
                    <th className="pb-2 font-medium">Owner</th>
                    <th className="pb-2 font-medium">Value (IDR)</th>
                    <th className="pb-2 font-medium">Close Date</th>
                    <th className="pb-2 font-medium">Progress</th>
                    <th className="pb-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {client.opportunities.map((opp) => (
                    <tr key={opp.id} className="transition-colors hover:bg-layer-1">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex size-7 items-center justify-center rounded-lg">
                            <Building2 className="size-3.5" />
                          </div>
                          <div>
                            <div className="font-semibold text-primary">{opp.title}</div>
                            <div className="text-[10px] text-tertiary">{opp.category}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                          {opp.stage}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1.5 font-medium text-primary">
                          <div className="flex size-5 items-center justify-center rounded-full bg-layer-2 text-[10px] font-bold">
                            {opp.owner.name.charAt(0)}
                          </div>
                          <span>{opp.owner.name}</span>
                        </div>
                      </td>
                      <td className="py-3 font-medium text-secondary">{opp.valueIdr}</td>
                      <td className="py-3 font-medium text-secondary">{opp.closeDate}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-16 overflow-hidden rounded-full bg-layer-2">
                            <div className="bg-blue-500 h-full rounded-full" style={{ width: `${opp.progress}%` }} />
                          </div>
                          <span className="text-[11px] font-bold text-primary">{opp.progress}%</span>
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <button type="button" className="text-secondary hover:text-primary">
                          <MoreHorizontal className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Projects Card */}
          <div className="shadow-sm rounded-2xl border border-subtle bg-surface-1 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-primary">Recent Projects</h2>
              <button
                type="button"
                onClick={() => setActiveTab("Projects")}
                className="text-xs inline-flex items-center gap-1 font-medium text-accent-primary hover:underline"
              >
                View all projects <ArrowRight className="size-3" />
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="text-xs w-full text-left">
                <thead>
                  <tr className="border-b border-subtle text-[11px] font-semibold text-tertiary uppercase">
                    <th className="pb-2 font-medium">Project</th>
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Owner</th>
                    <th className="pb-2 font-medium">Start Date</th>
                    <th className="pb-2 font-medium">End Date</th>
                    <th className="pb-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {client.projects.map((proj) => (
                    <tr key={proj.id} className="transition-colors hover:bg-layer-1">
                      <td className="py-3 font-semibold text-primary">
                        <div>
                          <div>{proj.name}</div>
                          <div className="font-normal text-[10px] text-tertiary">{client.name}</div>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className="rounded bg-layer-2 px-2 py-0.5 text-[10px] font-bold text-secondary">
                          {proj.type}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 font-semibold">
                          ● {proj.status}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1.5 font-medium text-primary">
                          <div className="flex size-5 items-center justify-center rounded-full bg-layer-2 text-[10px] font-bold">
                            {proj.owner.name.charAt(0)}
                          </div>
                          <span>{proj.owner.name}</span>
                        </div>
                      </td>
                      <td className="py-3 text-secondary">{proj.startDate}</td>
                      <td className="py-3 text-secondary">{proj.endDate}</td>
                      <td className="py-3 text-right">
                        <button type="button" className="text-secondary hover:text-primary">
                          <MoreHorizontal className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Key Contacts Card */}
          <div className="shadow-sm rounded-2xl border border-subtle bg-surface-1 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-primary">Key Contacts</h2>
              <button
                type="button"
                onClick={() => setActiveTab("Contacts")}
                className="text-xs inline-flex items-center gap-1 font-medium text-accent-primary hover:underline"
              >
                View all contacts <ArrowRight className="size-3" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {client.contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="hover:border-accent-primary/40 flex flex-col justify-between rounded-xl border border-subtle bg-layer-1 p-4 transition-all hover:bg-layer-2"
                >
                  <div>
                    <div className="flex size-10 items-center justify-center rounded-full bg-layer-2 font-bold text-primary">
                      {contact.name.charAt(0)}
                    </div>
                    <div className="mt-3">
                      <h3 className="text-xs font-bold text-primary">{contact.name}</h3>
                      <p className="text-[11px] font-medium text-secondary">{contact.role}</p>
                      <p className="mt-1 truncate text-[11px] text-tertiary">{contact.email}</p>
                      <p className="text-[11px] text-tertiary">{contact.phone}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 border-t border-subtle pt-2.5">
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex size-7 items-center justify-center rounded-lg border border-subtle bg-surface-1 text-secondary hover:text-accent-primary"
                      title="Send email"
                    >
                      <Mail className="size-3.5" />
                    </a>
                    <a
                      href={`tel:${contact.phone}`}
                      className="flex size-7 items-center justify-center rounded-lg border border-subtle bg-surface-1 text-secondary hover:text-accent-primary"
                      title="Call phone"
                    >
                      <Phone className="size-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity Timeline Card */}
          <div className="shadow-sm rounded-2xl border border-subtle bg-surface-1 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-primary">Recent Activity</h2>
              <button
                type="button"
                onClick={() => setActiveTab("Activity")}
                className="text-xs inline-flex items-center gap-1 font-medium text-accent-primary hover:underline"
              >
                View all activity <ArrowRight className="size-3" />
              </button>
            </div>

            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              {client.activities.map((act, index) => {
                const isLast = index === client.activities.length - 1;
                return (
                  <div key={act.id} className="relative flex flex-1 flex-col items-center text-center">
                    {/* Connecting line */}
                    {!isLast && (
                      <div className="absolute top-4 left-1/2 hidden h-0.5 w-full -translate-y-1/2 bg-layer-2 sm:block" />
                    )}

                    <div className="border-surface-1 shadow-sm relative z-10 flex size-8 items-center justify-center rounded-full border-2 bg-layer-2 text-accent-primary">
                      {act.type === "meeting" && <MessageSquare className="text-blue-500 size-3.5" />}
                      {act.type === "document" && <FileText className="text-emerald-500 size-3.5" />}
                      {act.type === "upload" && <Upload className="text-purple-500 size-3.5" />}
                      {act.type === "proposal" && <Mail className="text-amber-500 size-3.5" />}
                      {act.type === "event" && <Calendar className="text-indigo-500 size-3.5" />}
                    </div>

                    <div className="mt-2.5">
                      <p className="text-xs line-clamp-2 font-semibold text-primary">{act.title}</p>
                      <p className="mt-0.5 text-[10px] font-medium text-secondary">{act.timestamp}</p>
                      <p className="text-[10px] text-tertiary">by {act.author}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Sidebar Panels */}
        <div className="flex flex-col gap-6">
          {/* Relationship Health */}
          <div className="shadow-sm rounded-2xl border border-subtle bg-surface-1 p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm flex items-center gap-1.5 font-semibold text-primary">
                <span>Relationship Health</span>
                <Info className="size-3.5 text-tertiary" />
              </div>
            </div>

            <div className="mt-3">
              <span className="bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400 rounded-full px-2.5 py-0.5 font-bold">
                ● {client.relationshipHealth.status}
              </span>
              <p className="text-xs mt-2 text-secondary">{client.relationshipHealth.summary}</p>
            </div>

            <div className="text-xs mt-4 space-y-2.5 border-t border-subtle pt-3">
              <div>
                <div className="font-semibold text-primary">✓ Regular communication</div>
                <div className="text-[11px] text-secondary">{client.relationshipHealth.communication}</div>
              </div>
              <div>
                <div className="font-semibold text-primary">✓ Projects on track</div>
                <div className="text-[11px] text-secondary">{client.relationshipHealth.projectsOnTrack}</div>
              </div>
              <div>
                <div className="font-semibold text-primary">✓ High satisfaction</div>
                <div className="text-[11px] text-secondary">{client.relationshipHealth.satisfaction}</div>
              </div>
            </div>
          </div>

          {/* Client Information */}
          <div className="shadow-sm rounded-2xl border border-subtle bg-surface-1 p-5">
            <h2 className="text-sm font-semibold text-primary">Client Information</h2>
            <dl className="text-xs mt-3 space-y-2.5">
              <div>
                <dt className="text-tertiary">Legal Name</dt>
                <dd className="font-semibold text-primary">{client.legalName}</dd>
              </div>
              <div>
                <dt className="text-tertiary">Industry</dt>
                <dd className="font-semibold text-primary">{client.industry}</dd>
              </div>
              <div>
                <dt className="text-tertiary">Website</dt>
                <dd className="mt-0.5">
                  <a
                    href={`https://${client.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-accent-primary hover:underline"
                  >
                    {client.website}
                    <ExternalLink className="size-3" />
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-tertiary">Head Office</dt>
                <dd className="font-semibold text-primary">{client.headOffice}</dd>
              </div>
              <div>
                <dt className="text-tertiary">Client Since</dt>
                <dd className="font-semibold text-primary">{client.since}</dd>
              </div>
              <div>
                <dt className="text-tertiary">Account Manager</dt>
                <dd className="mt-1 flex items-center gap-1.5 font-semibold text-primary">
                  <div className="flex size-5 items-center justify-center rounded-full bg-layer-2 text-[10px]">
                    <User className="size-3" />
                  </div>
                  <span>{client.accountManager.name}</span>
                </dd>
              </div>
            </dl>
          </div>

          {/* Notes Card */}
          <div className="shadow-sm rounded-2xl border border-subtle bg-surface-1 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-primary">Notes</h2>
              <button
                type="button"
                onClick={() => setActiveTab("Notes")}
                className="text-xs inline-flex items-center gap-1 font-medium text-accent-primary hover:underline"
              >
                View all notes <ArrowRight className="size-3" />
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {client.notes.map((note) => (
                <div
                  key={note.id}
                  className="flex items-center gap-2.5 rounded-xl border border-subtle bg-layer-1 p-3 transition-colors hover:bg-layer-2"
                >
                  <FileText className="text-blue-500 size-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs truncate font-semibold text-primary">{note.title}</h4>
                    <p className="text-[10px] text-tertiary">
                      {note.date} • {note.author}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AddClientModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={() => setShowEditModal(false)}
      />
    </div>
  );
}
