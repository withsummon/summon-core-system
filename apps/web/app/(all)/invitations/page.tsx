/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { PlaneLogo } from "@plane/propel/icons";
import { NativeWorkspaceInvitations } from "@/components/account/native-entry/workspace-invitations";
import { SessionBoundary } from "@/components/convex-core/identity/session-boundary";
import { LogoSpinner } from "@/components/common/logo-spinner";
import { useAppRouter } from "@/hooks/use-app-router";

function UserInvitationsContent() {
  const router = useAppRouter();
  const profile = useQuery(api.identity.profile.get);
  if (!profile)
    return (
      <div className="grid size-full place-items-center">
        <LogoSpinner />
      </div>
    );
  return (
    <div className="flex h-full flex-col gap-y-2 overflow-hidden sm:flex-row sm:gap-y-0">
      <div className="relative h-1/6 flex-shrink-0 sm:w-2/12 md:w-3/12 lg:w-1/5">
        <div className="absolute top-1/2 left-0 h-[0.5px] w-full -translate-y-1/2 border-b-[0.5px] border-subtle sm:top-0 sm:left-1/2 sm:h-screen sm:w-[0.5px] sm:-translate-x-1/2 sm:translate-y-0 sm:border-r-[0.5px] md:left-1/3" />
        <Link
          href="/"
          className="absolute top-1/2 left-5 z-10 grid -translate-y-1/2 place-items-center px-3 sm:top-12 sm:left-1/2 sm:-translate-x-[15px] sm:translate-y-0 sm:px-0 sm:py-5 md:left-1/3"
        >
          <PlaneLogo className="h-9 w-auto text-primary" />
        </Link>
        <div className="absolute top-1/4 right-4 -translate-y-1/2 text-13 text-primary sm:fixed sm:top-12 sm:right-16 sm:translate-y-0 sm:py-5">
          {profile.email}
        </div>
      </div>
      <div className="relative flex h-full justify-center px-8 pb-8 sm:w-10/12 sm:items-center sm:justify-start sm:p-0 sm:pr-[8.33%] md:w-9/12 lg:w-4/5">
        <div className="w-full">
          <NativeWorkspaceInvitations
            presentation="standalone"
            onCreate={() => router.push("/")}
            onComplete={(invitation) => router.push(`/${invitation.slug}/stickies`)}
          />
        </div>
      </div>
    </div>
  );
}
export default function UserInvitationsPage() {
  return (
    <SessionBoundary>
      <UserInvitationsContent />
    </SessionBoundary>
  );
}
