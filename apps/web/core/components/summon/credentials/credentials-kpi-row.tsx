/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { Lock, Key, Users, Clock, AlertTriangle } from "lucide-react";
import { CREDENTIAL_KPIS } from "./mock-data";
import type { ICredentialKpi } from "./types";

interface ICredentialsKpiRowProps {
  kpis?: ICredentialKpi;
}

export const CredentialsKpiRow: React.FC<ICredentialsKpiRowProps> = ({
  kpis = CREDENTIAL_KPIS,
}) => {
  const cards = [
    {
      id: "total",
      label: "Total Credentials",
      value: kpis.totalCredentials,
      subtitle: `Across ${kpis.totalProjects} projects`,
      icon: Lock,
      iconColor: "text-blue-600 dark:text-blue-400",
      iconBg: "bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800",
    },
    {
      id: "active",
      label: "Active Accounts",
      value: kpis.activeAccounts,
      subtitle: `${kpis.activeAccountsPercentage}% of total`,
      icon: Key,
      iconColor: "text-emerald-600 dark:text-emerald-400",
      iconBg: "bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800",
    },
    {
      id: "shared",
      label: "Shared With Me",
      value: kpis.sharedWithMe,
      subtitle: `From ${kpis.sharedFromProjects} projects`,
      icon: Users,
      iconColor: "text-amber-600 dark:text-amber-400",
      iconBg: "bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800",
    },
    {
      id: "expiring",
      label: "Expiring Soon",
      value: kpis.expiringSoon,
      subtitle: `Within ${kpis.expiringDaysLimit} days`,
      icon: Clock,
      iconColor: "text-purple-600 dark:text-purple-400",
      iconBg: "bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800",
    },
    {
      id: "risky",
      label: "Risky Credentials",
      value: kpis.riskyCredentials,
      subtitle: "Require attention",
      icon: AlertTriangle,
      iconColor: "text-red-600 dark:text-red-400",
      iconBg: "bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 w-full">
      {cards.map((card) => {
        const IconComp = card.icon;
        return (
          <div
            key={card.id}
            className="flex items-center gap-3.5 rounded-xl border border-subtle bg-surface-1 p-3.5 shadow-2xs hover:border-strong transition-all"
          >
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${card.iconBg} ${card.iconColor}`}
            >
              <IconComp size={18} />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-secondary truncate block">
                {card.label}
              </span>
              <p className="text-lg font-bold text-primary tracking-tight">{card.value}</p>
              <span className="text-[10px] text-placeholder truncate block mt-0.5">
                {card.subtitle}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
