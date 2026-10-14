/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import Link from "next/link";
import { Lock, Cloud, Key, Shield } from "lucide-react";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import type { ISummonCredential } from "@plane/types";
import { getButtonStyling } from "@plane/propel/button";
import { cn } from "@plane/utils";
import { SummonCard } from "@/components/summon/screen";

interface ICredentialsSidebarCardProps {
  credentials: ISummonCredential[];
  workspaceSlug?: string;
}

export function CredentialsSidebarCard({ credentials, workspaceSlug }: ICredentialsSidebarCardProps) {
  const credentialsHref = workspaceSlug ? `/${workspaceSlug}/summon/credentials` : "/summon/credentials";
  const displayCredentials = credentials.slice(0, 3);

  return (
    <SummonCard>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-primary">Credentials</h3>
        <Link href={credentialsHref} className="text-12 font-medium text-accent-primary hover:underline">
          View all
        </Link>
      </div>

      <div className="mt-3 space-y-2.5">
        {displayCredentials.length > 0 ? (
          displayCredentials.map((cred) => {
            const isAws = cred.name.toLowerCase().includes("aws");
            const isGit = cred.name.toLowerCase().includes("git");

            return (
              <div
                key={cred.id}
                className="flex items-center justify-between rounded-lg border border-subtle bg-layer-1 p-2.5 text-13"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div
                    className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${
                      isAws
                        ? "bg-label-indigo-bg text-label-indigo-icon"
                        : isGit
                          ? "bg-label-orange-bg text-label-orange-icon"
                          : "bg-label-purple-bg text-label-purple-icon"
                    }`}
                  >
                    {isAws ? (
                      <Cloud className="size-3.5" />
                    ) : isGit ? (
                      <Shield className="size-3.5" />
                    ) : (
                      <Key className="size-3.5" />
                    )}
                  </div>
                  <div className="min-w-0 truncate">
                    <div className="truncate font-medium text-primary" title={cred.name}>
                      {cred.name}
                    </div>
                    <div className="truncate text-12 text-tertiary">
                      {cred.account_identifier || cred.provider || "Authorized"}
                    </div>
                  </div>
                </div>

                <Lock className="size-3.5 shrink-0 text-tertiary" />
              </div>
            );
          })
        ) : (
          <EmptyStateCompact
            assetKey="token"
            assetClassName="size-20"
            title="No credentials yet"
            rootClassName="py-4"
          />
        )}
      </div>

      <Link href={credentialsHref} className={cn(getButtonStyling("secondary", "base"), "mt-4 w-full")}>
        <Lock className="size-3.5" />
        Open credential manager
      </Link>
    </SummonCard>
  );
}
