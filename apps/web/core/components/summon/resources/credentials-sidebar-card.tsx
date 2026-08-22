/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import Link from "next/link";
import { Lock, Cloud, Key, Shield } from "lucide-react";
import type { ISummonCredential } from "@plane/types";

interface ICredentialsSidebarCardProps {
  credentials: ISummonCredential[];
  workspaceSlug?: string;
}

export function CredentialsSidebarCard({ credentials, workspaceSlug }: ICredentialsSidebarCardProps) {
  const credentialsHref = workspaceSlug ? `/${workspaceSlug}/summon/credentials` : "/summon/credentials";
  const displayCredentials = credentials.slice(0, 3);

  return (
    <div className="shadow-sm rounded-2xl border border-subtle bg-surface-1 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-primary">Credentials</h3>
        <Link href={credentialsHref} className="text-xs font-semibold text-accent-primary hover:underline">
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
                className="text-xs flex items-center justify-between rounded-xl border border-subtle bg-layer-1 p-2.5 transition-colors hover:bg-layer-2"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div
                    className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${
                      isAws
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        : isGit
                          ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                          : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
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
                    <div className="truncate font-semibold text-primary">{cred.name}</div>
                    <div className="truncate text-[10px] text-tertiary">
                      {cred.account_identifier || cred.provider || "Authorized"}
                    </div>
                  </div>
                </div>

                <Lock className="size-3.5 shrink-0 text-tertiary" />
              </div>
            );
          })
        ) : (
          <div className="text-xs py-3 text-center text-tertiary">No credentials configured</div>
        )}
      </div>

      <Link
        href={credentialsHref}
        className="text-xs mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-primary/10 py-2.5 font-bold text-accent-primary transition-all hover:bg-accent-primary hover:text-white"
      >
        <Lock className="size-3.5" />
        Open Credential Manager
      </Link>
    </div>
  );
}
