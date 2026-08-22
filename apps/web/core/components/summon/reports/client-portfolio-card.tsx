/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import Link from "next/link";
import { ArrowRight, Users, UserCheck, UserPlus, Award } from "lucide-react";
import { CLIENT_DATABASE_STATS, TOP_CLIENTS_REVENUE } from "./mock-data";

export function ClientPortfolioCard({ workspaceSlug }: { workspaceSlug?: string }) {
  const clientsLink = workspaceSlug ? `/${workspaceSlug}/summon/clients` : "/summon/clients";

  return (
    <div className="shadow-sm flex h-full flex-col justify-between rounded-2xl border border-subtle bg-surface-1 p-5">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-primary">Portfolio / Client Database</h2>
          <Link
            href={clientsLink}
            className="text-xs inline-flex items-center gap-1 font-medium text-accent-primary hover:underline"
          >
            View all clients <ArrowRight className="size-3" />
          </Link>
        </div>

        {/* 4 Mini KPI Badges */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rounded-xl border border-subtle bg-layer-1 p-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-secondary">
              <Users className="text-blue-500 size-3.5" />
              <span>Total Clients</span>
            </div>
            <div className="text-lg mt-1 font-bold text-primary">{CLIENT_DATABASE_STATS.totalClients}</div>
            <div className="text-emerald-600 dark:text-emerald-400 text-[10px] font-medium">
              ▲ {CLIENT_DATABASE_STATS.totalClientsChange}
            </div>
          </div>

          <div className="rounded-xl border border-subtle bg-layer-1 p-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-secondary">
              <UserCheck className="text-emerald-500 size-3.5" />
              <span>Active Clients</span>
            </div>
            <div className="text-lg mt-1 font-bold text-primary">{CLIENT_DATABASE_STATS.activeClients}</div>
            <div className="text-[10px] font-medium text-secondary">{CLIENT_DATABASE_STATS.activeClientsPercent}</div>
          </div>

          <div className="rounded-xl border border-subtle bg-layer-1 p-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-secondary">
              <UserPlus className="text-purple-500 size-3.5" />
              <span>New Clients (YTD)</span>
            </div>
            <div className="text-lg mt-1 font-bold text-primary">{CLIENT_DATABASE_STATS.newClientsYtd}</div>
            <div className="text-emerald-600 dark:text-emerald-400 text-[10px] font-medium">
              ▲ {CLIENT_DATABASE_STATS.newClientsChange}
            </div>
          </div>

          <div className="rounded-xl border border-subtle bg-layer-1 p-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-secondary">
              <Award className="text-amber-500 size-3.5" />
              <span>Client Retention</span>
            </div>
            <div className="text-lg mt-1 font-bold text-primary">{CLIENT_DATABASE_STATS.retentionRate}</div>
            <div className="text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
              {CLIENT_DATABASE_STATS.retentionBadge}
            </div>
          </div>
        </div>

        {/* Top Clients by Revenue */}
        <div className="mt-4">
          <div className="text-xs flex items-center justify-between font-semibold text-secondary">
            <span>Top Clients by Revenue (YTD)</span>
            <div className="flex items-center gap-6 text-[11px] text-tertiary">
              <span>Revenue (IDR)</span>
              <span>% Contribution</span>
            </div>
          </div>

          <div className="mt-2 divide-y divide-subtle">
            {TOP_CLIENTS_REVENUE.map((item) => (
              <div key={item.client} className="text-xs flex items-center justify-between py-2">
                <span className="font-semibold text-primary">{item.client}</span>
                <div className="flex items-center gap-6">
                  <span className="w-16 text-right font-medium text-primary">{item.revenue}</span>
                  <span className="w-16 text-right font-semibold text-secondary">{item.contribution}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
