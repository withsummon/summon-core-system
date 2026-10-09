/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Navigate, useLocation, useSearchParams } from "react-router";
import { useConvexAuth, useQuery } from "convex/react";
import { EAuthModes } from "@plane/constants";
import { isValidNextPath } from "@plane/utils";
import { api } from "@summon/convex/api";
import { NativeEntryAuth } from "@/components/account/native-entry/auth";
import { SessionBoundary } from "@/components/convex-core/identity/session-boundary";

export function AuthBase({
  authType,
  initialStep = "email",
}: {
  authType: EAuthModes;
  initialStep?: "email" | "reset";
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading)
    return (
      <p role="status" className="p-8">
        Restoring your session…
      </p>
    );
  if (!isAuthenticated)
    return (
      <NativeEntryAuth
        key={`${authType}:${initialStep}`}
        initialState={
          initialStep === "reset" ? { flow: "reset", mode: EAuthModes.SIGN_IN } : { flow: "email", mode: authType }
        }
      />
    );
  return (
    <SessionBoundary>
      <AccountDestination />
    </SessionBoundary>
  );
}

export function AccountDestination() {
  const location = useLocation();
  const [params] = useSearchParams();
  const destination = useQuery(api.identity.preferences.destination);
  if (!destination)
    return (
      <p role="status" className="p-8">
        Loading your workspace…
      </p>
    );
  if (!destination.onboardingComplete) return <Navigate to={`/onboarding?${params}`} replace />;
  const nextPath = params.get("next_path");
  if (
    nextPath &&
    isValidNextPath(nextPath) &&
    new URL(nextPath.trim(), window.location.origin).pathname !== location.pathname
  )
    return <Navigate to={nextPath.trim()} replace />;
  return (
    <Navigate to={destination.workspace ? `/${destination.workspace.slug}/stickies` : "/create-workspace"} replace />
  );
}
