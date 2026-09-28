/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Boxes, Share2, Star, User2 } from "lucide-react";
import { CheckIcon, CloseIcon } from "@plane/propel/icons";
import { LogoSpinner } from "@/components/common/logo-spinner";
import { EmptySpace, EmptySpaceItem } from "@/components/ui/empty-space";
import { authClient } from "@/components/convex-core/provider";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { useAppRouter } from "@/hooks/use-app-router";
import { SessionBoundary } from "@/components/convex-core/identity/session-boundary";

export default function WorkspaceInvitationPage() {
  const { isAuthenticated } = useConvexAuth();
  return isAuthenticated ? (
    <SessionBoundary>
      <WorkspaceInvitationContent />
    </SessionBoundary>
  ) : (
    <WorkspaceInvitationContent />
  );
}
function WorkspaceInvitationContent() {
  const router = useAppRouter();
  const [params] = useSearchParams();
  const invitationId = params.get("invitation_id");
  const token = params.get("token");
  const preview = useAction(api.invitations.email.preview);
  const respond = useAction(api.invitations.tokens.respond);
  const [invitation, setInvitation] = useState<FunctionReturnType<typeof api.invitations.email.preview> | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { data: session } = authClient.useSession();
  const workspaces = useQuery(api.workspaces.index.list, isAuthenticated ? {} : "skip");
  const membership = workspaces?.find((row) => row._id === invitation?.workspace.id);
  useEffect(() => {
    let active = true;
    setInvitation(null);
    setError("");
    setLoading(true);
    if (!invitationId || !token) {
      setError("This invitation link is not active anymore.");
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const result = await preview({ invitationId, token });
        if (active) setInvitation(result);
      } catch (failure) {
        if (active) setError(mutationMessage(failure));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [invitationId, token, preview]);
  const signInHref = `/?next_path=${encodeURIComponent(`/workspace-invitations?${params}`)}`;
  const homeAction = isAuthenticated
    ? { Icon: Boxes, title: "Continue to home", href: "/" }
    : { Icon: User2, title: "Sign in to continue", href: signInHref };
  const answer = async (accepted: boolean) => {
    if (!invitation || !token || pending) return;
    setPending(true);
    setError("");
    try {
      const destination = await respond({ invitationId: invitation.id, token, accepted });
      router.push(accepted ? `/${destination.slug}/stickies` : "/");
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-3">
      {loading || isLoading || (isAuthenticated && !workspaces) ? (
        <div className="flex size-full items-center justify-center">
          <LogoSpinner />
        </div>
      ) : invitation && membership && (invitation.project === null || invitation.status === "accepted") ? (
        <EmptySpace
          title={`You are already a member of ${invitation.workspace.name}`}
          description="Your workspace is where you'll create projects, collaborate on your work items, and organize different streams of work in your Plane account."
        >
          <EmptySpaceItem Icon={Boxes} title="Continue to home" href={`/${membership.slug}/stickies`} />
        </EmptySpace>
      ) : invitation?.status === "accepted" ? (
        <EmptySpace
          title={`This invitation to ${invitation.workspace.name} has already been accepted.`}
          description="Workspace access is no longer available to this account. Contact a workspace administrator to restore access."
        >
          <EmptySpaceItem Icon={Boxes} title="Continue to home" href="/" />
        </EmptySpace>
      ) : invitation ? (
        <EmptySpace
          title={`You have been invited to ${invitation.workspace.name}`}
          description="Your workspace is where you'll create projects, collaborate on your work items, and organize different streams of work in your Plane account."
        >
          {!isAuthenticated ? (
            <EmptySpaceItem {...homeAction} />
          ) : session?.user.email !== invitation.email ? (
            <EmptySpaceItem
              Icon={User2}
              title={`Sign in as ${invitation.email} to continue`}
              disabled={pending}
              action={async () => {
                setPending(true);
                setError("");
                try {
                  const result = await authClient.signOut();
                  if (result.error) setError(result.error.message ?? "Could not sign out.");
                  else router.push(signInHref);
                } catch (failure) {
                  setError(mutationMessage(failure));
                } finally {
                  setPending(false);
                }
              }}
            />
          ) : (
            <>
              <EmptySpaceItem Icon={CheckIcon} title="Accept" action={() => void answer(true)} disabled={pending} />
              <EmptySpaceItem Icon={CloseIcon} title="Ignore" action={() => void answer(false)} disabled={pending} />
            </>
          )}
          {error && (
            <li role="alert" className="py-3 text-13 text-danger-primary">
              {error}
            </li>
          )}
        </EmptySpace>
      ) : (
        <EmptySpace
          title="This invitation link is not active anymore."
          description="Your workspace is where you'll create projects, collaborate on your work items, and organize different streams of work in your Plane account."
          link={{ text: "Or start from an empty project", href: "/" }}
        >
          <EmptySpaceItem {...homeAction} />
          <EmptySpaceItem Icon={Star} title="Star us on GitHub" href="https://github.com/makeplane" />
          <EmptySpaceItem Icon={Share2} title="Join our community of active creators" href="https://forum.plane.so" />
          {error && (
            <li role="alert" className="py-3 text-13 text-danger-primary">
              {error}
            </li>
          )}
        </EmptySpace>
      )}
    </div>
  );
}
