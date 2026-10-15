/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { getWorkspaceHomePath } from "@plane/constants";
import type { IUser, IUserSettings, IWorkspace, TUserProfile } from "@plane/types";
// helpers
import { isValidNextPath } from "@plane/utils";
import { EPageTypes } from "@/helpers/authentication.helper";

// Delegates to the shared isValidNextPath (@plane/utils) instead of a local
// reimplementation. A from-scratch version here previously resolved the
// value against location.origin and required the result to stay
// same-origin — which has its own gap: a next_path like "http:evil.com"
// resolves AS IF relative whenever the input's scheme happens to match the
// real origin's own scheme, e.g. any self-hosted deployment actually
// serving over plain http (verified directly: this bypasses the
// location.origin-based check on an http:// origin, though not on https://,
// since the schemes then differ). isValidNextPath closes this by requiring
// a literal leading "/" (and rejecting "//") before any URL-based
// comparison, so it doesn't depend on which scheme the real origin happens
// to use.
const isValidURL = isValidNextPath;

export function getIsUserOnboard(currentUserProfile: TUserProfile | undefined): boolean {
  return (
    currentUserProfile?.is_onboarded ||
    (currentUserProfile?.onboarding_step?.profile_complete &&
      currentUserProfile?.onboarding_step?.workspace_create &&
      currentUserProfile?.onboarding_step?.workspace_invite &&
      currentUserProfile?.onboarding_step?.workspace_join) ||
    false
  );
}

export function getWorkspaceRedirectionUrl(
  nextPath: string | null,
  currentUserSettings: IUserSettings | undefined,
  workspaces: Record<string, IWorkspace> | undefined
): string {
  let redirectionRoute = "/create-workspace";

  // validating the nextPath from the router query
  if (nextPath && isValidURL(nextPath.toString())) {
    redirectionRoute = nextPath.toString();
    return redirectionRoute;
  }

  // validate the last and fallback workspace_slug
  const currentWorkspaceSlug =
    currentUserSettings?.workspace?.last_workspace_slug || currentUserSettings?.workspace?.fallback_workspace_slug;

  // validate the current workspace_slug is available in the user's workspace list
  const currentWorkspace = Object.values(workspaces || {}).find((workspace) => workspace.slug === currentWorkspaceSlug);

  if (currentWorkspace) redirectionRoute = getWorkspaceHomePath(currentWorkspace.slug);

  return redirectionRoute;
}

export type TAuthRedirectDecision = { action: "render" } | { action: "push" | "replace"; url: string };

type TAuthRedirectContext = {
  currentUser: IUser | undefined;
  currentUserProfile: TUserProfile | undefined;
  isUserOnboard: boolean;
  pathname: string | null;
  /** Lazily resolved so it is only computed on branches that redirect to a workspace. */
  getWorkspaceRedirectUrl: () => string;
};

const RENDER: TAuthRedirectDecision = { action: "render" };

const getSignInUrl = (pathname: string | null) => `/${pathname ? `?next_path=${pathname}` : ``}`;

function resolveNonAuthenticated(ctx: TAuthRedirectContext): TAuthRedirectDecision {
  if (!ctx.currentUser?.id) return RENDER;
  if (ctx.currentUserProfile?.id && ctx.isUserOnboard) return { action: "push", url: ctx.getWorkspaceRedirectUrl() };
  return { action: "push", url: "/onboarding" };
}

function resolveOnboarding(ctx: TAuthRedirectContext): TAuthRedirectDecision {
  if (!ctx.currentUser?.id) return { action: "push", url: getSignInUrl(ctx.pathname) };
  if (ctx.currentUser && ctx.currentUserProfile?.id && ctx.isUserOnboard)
    return { action: "replace", url: ctx.getWorkspaceRedirectUrl() };
  return RENDER;
}

function resolveSetPassword(ctx: TAuthRedirectContext): TAuthRedirectDecision {
  const { currentUser, currentUserProfile, isUserOnboard } = ctx;
  if (!currentUser?.id) return { action: "push", url: getSignInUrl(ctx.pathname) };
  if (currentUser && !currentUser?.is_password_autoset && currentUserProfile?.id && isUserOnboard)
    return { action: "push", url: ctx.getWorkspaceRedirectUrl() };
  return RENDER;
}

function resolveAuthenticated(ctx: TAuthRedirectContext): TAuthRedirectDecision {
  if (!ctx.currentUser?.id) return { action: "push", url: getSignInUrl(ctx.pathname) };
  if (ctx.currentUserProfile && ctx.currentUserProfile?.id && ctx.isUserOnboard) return RENDER;
  return { action: "push", url: `/onboarding` };
}

const RESOLVERS: Partial<Record<EPageTypes, (ctx: TAuthRedirectContext) => TAuthRedirectDecision>> = {
  [EPageTypes.NON_AUTHENTICATED]: resolveNonAuthenticated,
  [EPageTypes.ONBOARDING]: resolveOnboarding,
  [EPageTypes.SET_PASSWORD]: resolveSetPassword,
  [EPageTypes.AUTHENTICATED]: resolveAuthenticated,
};

/** Decides whether a page of the given type renders or redirects for the current user state. */
export function resolveAuthRedirect(pageType: EPageTypes, ctx: TAuthRedirectContext): TAuthRedirectDecision {
  const resolver = RESOLVERS[pageType];
  return resolver ? resolver(ctx) : RENDER;
}
