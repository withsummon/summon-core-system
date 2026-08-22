/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Link } from "react-router";
import { SummonCard, SummonScreen } from "@/components/summon/screen";
import type { Route } from "./+types/page";

export default function SummonSettingsPage({ params }: Route.ComponentProps) {
  return (
    <SummonScreen
      title="Settings"
      description="Summon follows Plane workspace membership, project access, notifications, and file policies."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <SummonCard>
          <h2 className="text-sm font-semibold text-primary">Workspace access</h2>
          <p className="text-sm mt-2 text-secondary">
            Manage members and roles once in Plane. Summon API permissions read the same active memberships.
          </p>
          <Link
            className="text-sm mt-3 inline-block text-accent-primary"
            to={`/${params.workspaceSlug}/settings/members`}
          >
            Open Plane members →
          </Link>
        </SummonCard>
        <SummonCard>
          <h2 className="text-sm font-semibold text-primary">Data ownership</h2>
          <p className="text-sm mt-2 text-secondary">
            Plane owns users, projects, work items, pages, assets, and notifications. Summon owns CRM, meeting context,
            external links, automation metadata, and encrypted credentials.
          </p>
        </SummonCard>
      </div>
    </SummonScreen>
  );
}
