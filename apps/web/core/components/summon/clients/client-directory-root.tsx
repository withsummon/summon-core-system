/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import Link from "next/link";
import { Building2, Search, Plus, ArrowRight, ExternalLink, Users, Briefcase, TrendingUp } from "lucide-react";
import { ALL_CLIENTS_DIRECTORY } from "./mock-data";
import { AddClientModal } from "./add-client-modal";
import type { IClientDetail } from "./types";

interface IClientDirectoryRootProps {
  workspaceSlug?: string;
}

export function ClientDirectoryRoot({ workspaceSlug }: IClientDirectoryRootProps) {
  const [clients, setClients] = useState<IClientDetail[]>(ALL_CLIENTS_DIRECTORY);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("All");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const industries = ["All", "Financial Services", "Banking", "Fintech & Lending", "Multi-finance"];

  const filteredClients = clients.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.legalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.industry.toLowerCase().includes(searchQuery.toLowerCase());
    const matchIndustry = selectedIndustry === "All" || c.industry === selectedIndustry;
    return matchSearch && matchIndustry;
  });

  const handleAddClient = (newClientData: Partial<IClientDetail>) => {
    const newClient: IClientDetail = {
      id: newClientData.name?.toLowerCase().replace(/\s+/g, "-") || `client-${Date.now()}`,
      name: newClientData.name || "New Client",
      legalName: newClientData.legalName || "PT New Client",
      status: "Active Client",
      since: newClientData.since || "2025",
      industry: newClientData.industry || "Financial Services",
      website: newClientData.website || "www.client.com",
      headOffice: newClientData.headOffice || "Jakarta, Indonesia",
      accountManager: newClientData.accountManager || { name: "Fikri Adriansyah" },
      description: newClientData.description || "Enterprise client account.",
      kpis: {
        activeOpportunities: 0,
        activeProjects: 0,
        totalProjects: 0,
        lastInteraction: "Just now",
        lastInteractionDetail: "Account Created",
      },
      opportunities: [],
      projects: [],
      contacts: [],
      activities: [],
      relationshipHealth: {
        status: "Good",
        summary: "New account initialized.",
        communication: "Last: Today",
        projectsOnTrack: "100%",
        satisfaction: "Pending feedback",
      },
      notes: [],
    };
    setClients((prev) => [newClient, ...prev]);
  };

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Commercial Clients</h1>
          <p className="text-xs font-medium text-secondary">
            Enterprise client database, relationships, delivery contracts, and commercial portfolio.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="text-xs shadow-sm flex items-center gap-1.5 rounded-xl bg-accent-primary px-4 py-2 font-bold text-white transition-all hover:bg-accent-primary/90"
        >
          <Plus className="size-4" />
          Add Client
        </button>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="shadow-sm flex items-center gap-3.5 rounded-2xl border border-subtle bg-surface-1 p-4">
          <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 flex size-10 items-center justify-center rounded-xl">
            <Building2 className="size-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-secondary">Total Clients</div>
            <div className="text-xl font-bold text-primary">{clients.length} Enterprise Accounts</div>
          </div>
        </div>

        <div className="shadow-sm flex items-center gap-3.5 rounded-2xl border border-subtle bg-surface-1 p-4">
          <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex size-10 items-center justify-center rounded-xl">
            <Briefcase className="size-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-secondary">Active Engagements</div>
            <div className="text-xl text-emerald-600 dark:text-emerald-400 font-bold">
              {clients.filter((c) => c.status === "Active Client").length} Active Clients
            </div>
          </div>
        </div>

        <div className="shadow-sm flex items-center gap-3.5 rounded-2xl border border-subtle bg-surface-1 p-4">
          <div className="bg-purple-500/10 text-purple-600 dark:text-purple-400 flex size-10 items-center justify-center rounded-xl">
            <TrendingUp className="size-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-secondary">Portfolio Retention</div>
            <div className="text-xl font-bold text-primary">91% (Excellent)</div>
          </div>
        </div>
      </div>

      {/* Search & Filter Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by client name, legal name, or industry..."
            className="text-xs placeholder-tertiary shadow-sm focus:border-accent-primary w-full rounded-xl border border-subtle bg-surface-1 py-2 pr-4 pl-9 text-primary focus:outline-none"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {industries.map((ind) => (
            <button
              key={ind}
              type="button"
              onClick={() => setSelectedIndustry(ind)}
              className={`text-xs rounded-lg px-3 py-1.5 font-medium transition-all ${
                selectedIndustry === ind
                  ? "bg-accent-primary font-semibold text-white"
                  : "border border-subtle bg-surface-1 text-secondary hover:bg-layer-1 hover:text-primary"
              }`}
            >
              {ind}
            </button>
          ))}
        </div>
      </div>

      {/* Client Directory Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredClients.map((client) => {
          const detailUrl = workspaceSlug
            ? `/${workspaceSlug}/summon/clients/${client.id}`
            : `/summon/clients/${client.id}`;

          return (
            <Link
              key={client.id}
              href={detailUrl}
              className="group shadow-sm hover:border-accent-primary/50 hover:shadow-md flex flex-col justify-between rounded-2xl border border-subtle bg-surface-1 p-5 transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex size-11 items-center justify-center rounded-xl">
                      <Building2 className="size-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-primary group-hover:text-accent-primary">{client.name}</h3>
                      <p className="text-[11px] text-tertiary">{client.industry}</p>
                    </div>
                  </div>
                  <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full px-2 py-0.5 text-[10px] font-bold">
                    {client.status}
                  </span>
                </div>

                <p className="text-xs mt-3 line-clamp-2 text-secondary">{client.description}</p>

                <div className="text-xs mt-4 grid grid-cols-3 gap-2 rounded-xl bg-layer-1 p-2.5 text-center">
                  <div>
                    <div className="text-[10px] text-tertiary">Active Opps</div>
                    <div className="font-bold text-primary">{client.kpis.activeOpportunities}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-tertiary">Projects</div>
                    <div className="font-bold text-primary">{client.kpis.totalProjects}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-tertiary">Health</div>
                    <div className="text-emerald-600 dark:text-emerald-400 font-bold">
                      {client.relationshipHealth.status}
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-xs mt-4 flex items-center justify-between border-t border-subtle pt-3 text-secondary">
                <span className="text-[11px]">Since {client.since}</span>
                <span className="inline-flex items-center gap-1 font-semibold text-accent-primary group-hover:underline">
                  View Client Profile <ArrowRight className="size-3" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <AddClientModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSave={handleAddClient} />
    </div>
  );
}
