/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useAction, useMutation, useConvexAuth, useQuery } from "convex/react";
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
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [params] = useSearchParams();
  if (isLoading)
    return (
      <div className="flex size-full items-center justify-center">
        <LogoSpinner />
      </div>
    );
  if (!isAuthenticated)
    return (
      <div className="flex h-full w-full flex-col items-center justify-center px-3">
        <EmptySpace title="Sign in to review your invitation" description="Use the email address that was invited.">
          <EmptySpaceItem
            Icon={User2}
            title="Sign in to continue"
            href={`/?next_path=${encodeURIComponent(`/workspace-invitations/?${params}`)}`}
          />
        </EmptySpace>
      </div>
    );
  return (
    <SessionBoundary>
      <WorkspaceInvitationContent />
    </SessionBoundary>
  );
}
function WorkspaceInvitationContent() {
  const router = useAppRouter();
  const [params] = useSearchParams();
  const invitationId = params.get("invitation_id");
  const preview = useAction(api.invitations.email.incomingPreview);
  const respond = useMutation(api.invitations.index.respondIncoming);
  const [invitation, setInvitation] = useState<FunctionReturnType<typeof api.invitations.email.incomingPreview> | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const workspaces = useQuery(api.workspaces.index.list, {});
  const membership = workspaces?.find((row) => row._id === invitation?.workspace.id);
  useEffect(() => {
    let active = true;
    setInvitation(null);
    setError("");
    setLoading(true);
    if (!invitationId) {
      setError("This invitation link is not active anymore.");
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const result = await preview({ invitationId });
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
  }, [invitationId, preview]);
  const answer = async (accepted: boolean) => {
    if (!invitation || pending) return;
    setPending(true);
    setError("");
    try {
      const destination = await respond({
        invitationId: invitation.id,
        expectedRevision: invitation.revision,
        accepted,
      });
      router.push(accepted ? `/${destination.slug}/stickies` : "/");
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-3">
      {loading || !workspaces ? (
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
          <EmptySpaceItem Icon={CheckIcon} title="Accept" action={() => void answer(true)} disabled={pending} />
          <EmptySpaceItem Icon={CloseIcon} title="Ignore" action={() => void answer(false)} disabled={pending} />
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
          <EmptySpaceItem Icon={Boxes} title="Continue to home" href="/" />
          <EmptySpaceItem
            Icon={User2}
            title="Use a different account"
            disabled={pending}
            action={async () => {
              setPending(true);
              setError("");
              try {
                await authClient.signOut({ fetchOptions: { throw: true } });
              } catch (failure) {
                setError(mutationMessage(failure));
              } finally {
                setPending(false);
              }
            }}
          />
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
