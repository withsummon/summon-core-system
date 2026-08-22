/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import { Bell, Database, PlugZap, ShieldCheck, Users } from "lucide-react";
import { SummonCard, SummonScreen } from "@/components/summon/screen";
import type { Route } from "./+types/page";

export default function SummonSettingsPage({ params }: Route.ComponentProps) {
  return (
    <SummonScreen
      title="Settings"
      description="Summon follows Plane workspace membership, project access, notifications, and file policies."
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <SummonCard>
          <h2 className="text-sm font-semibold text-primary">Workspace configuration</h2>
          <div className="mt-4 divide-y divide-subtle">
            {[
              {
                Icon: Users,
                title: "Members & roles",
                description: "Manage workspace access once through Plane.",
                href: `/${params.workspaceSlug}/settings/members`,
              },
              {
                Icon: Bell,
                title: "Notifications",
                description: "Use Plane's notification preferences and delivery policies.",
                href: `/${params.workspaceSlug}/notifications`,
              },
              {
                Icon: PlugZap,
                title: "Integrations",
                description: "Manage connected services through the workspace integration settings.",
                href: `/${params.workspaceSlug}/settings/integrations`,
              },
            ].map(({ Icon, title, description, href }) => (
              <Link key={title} href={href} className="flex items-center gap-3 py-4 first:pt-0 last:pb-0">
                <span className="grid size-9 flex-shrink-0 place-items-center rounded-lg bg-accent-subtle text-accent-primary">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-sm block font-medium text-primary">{title}</span>
                  <span className="text-xs mt-0.5 block text-secondary">{description}</span>
                </span>
                <span className="text-accent-primary">→</span>
              </Link>
            ))}
          </div>
        </SummonCard>
        <div className="space-y-4">
          <SummonCard>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-accent-primary" />
              <h2 className="text-sm font-semibold text-primary">Security</h2>
            </div>
            <p className="text-sm mt-3 text-secondary">
              Permissions follow active Plane workspace membership. Credential reveals and rotations require password
              confirmation and remain audited.
            </p>
          </SummonCard>
          <SummonCard>
            <div className="flex items-center gap-2">
              <Database className="size-5 text-accent-primary" />
              <h2 className="text-sm font-semibold text-primary">Canonical ownership</h2>
            </div>
            <p className="text-sm mt-3 text-secondary">
              Plane owns users, projects, work items, pages, assets, and notifications. Summon owns CRM, meeting
              context, external links, automation metadata, and encrypted credentials.
            </p>
          </SummonCard>
        </div>
      </div>
    </SummonScreen>
  );
}
