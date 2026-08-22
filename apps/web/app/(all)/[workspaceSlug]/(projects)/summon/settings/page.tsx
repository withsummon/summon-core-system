/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import { Bell, Bot, Briefcase, CircleUser, FolderCog, LockKeyhole, ShieldCheck } from "lucide-react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonCard, SummonScreen } from "@/components/summon/screen";
import { useUserPermissions } from "@/hooks/store/user";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";

const SummonSettingsPage = observer(function SummonSettingsPage({ params }: Route.ComponentProps) {
  const { allowPermissions } = useUserPermissions();
  const isAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE, params.workspaceSlug);
  const {
    data: aiStatus,
    error,
    isLoading,
    mutate,
  } = useSWR(isAdmin ? ["summon-ai-status", params.workspaceSlug] : null, () =>
    summonService.getAIStatus(params.workspaceSlug)
  );

  if (!isAdmin)
    return (
      <SummonScreen title="Settings" description="Summon configuration follows Plane workspace permissions.">
        <SummonRequestState permissionError permissionMessage="Only workspace admins can view Summon settings." />
      </SummonScreen>
    );

  const links = [
    {
      Icon: Briefcase,
      title: "Workspace settings",
      description: "Workspace details and membership policy.",
      href: `/${params.workspaceSlug}/settings`,
    },
    {
      Icon: CircleUser,
      title: "Profile settings",
      description: "Profile and personal preferences.",
      href: "/settings/profile/general",
    },
    {
      Icon: FolderCog,
      title: "Project settings",
      description: "Canonical Plane project configuration.",
      href: `/${params.workspaceSlug}/settings/projects`,
    },
    {
      Icon: LockKeyhole,
      title: "Security",
      description: "Password and account security controls.",
      href: "/settings/profile/security",
    },
    {
      Icon: Bell,
      title: "Notification preferences",
      description: "Personal notification delivery preferences.",
      href: "/settings/profile/notifications",
    },
  ];

  return (
    <SummonScreen
      title="Settings"
      description="Summon follows Plane workspace membership, project access, notifications, and security policies."
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <SummonCard>
          <h2 className="text-sm font-semibold text-primary">Canonical Plane settings</h2>
          <div className="mt-4 divide-y divide-subtle">
            {links.map(({ Icon, title, description, href }) => (
              <Link
                key={title}
                href={href}
                className="flex items-center gap-3 py-4 first:pt-0 last:pb-0 focus-visible:outline focus-visible:outline-2"
              >
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
              <Bot className="size-5 text-accent-primary" />
              <h2 className="text-sm font-semibold text-primary">Instance AI</h2>
            </div>
            {!aiStatus ? (
              <div className="mt-3">
                <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />
              </div>
            ) : (
              <dl className="text-xs mt-3 grid gap-2">
                <div className="flex justify-between gap-3">
                  <dt className="text-secondary">Status</dt>
                  <dd className="font-medium text-primary">{aiStatus.configured ? "Configured" : "Not configured"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-secondary">Provider</dt>
                  <dd className="font-medium text-primary">{aiStatus.provider || "Not configured"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-secondary">Model</dt>
                  <dd className="font-medium text-primary">{aiStatus.model || "Not configured"}</dd>
                </div>
              </dl>
            )}
            <p className="text-xs mt-3 text-secondary">Only an instance administrator can change this configuration.</p>
          </SummonCard>
          <SummonCard>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-accent-primary" />
              <h2 className="text-sm font-semibold text-primary">Credential policy</h2>
            </div>
            <p className="text-sm mt-3 text-secondary">
              Secrets stay encrypted and masked. Reveal, rotation, and revocation require password confirmation and
              remain audited.
            </p>
            <Link
              href={`/${params.workspaceSlug}/summon/credentials`}
              className="text-xs mt-3 inline-block font-medium text-accent-primary focus-visible:outline focus-visible:outline-2"
            >
              Open Credential Vault →
            </Link>
          </SummonCard>
        </div>
      </div>
    </SummonScreen>
  );
});

export default SummonSettingsPage;
