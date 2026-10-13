/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Boxes, Share2, Star, User2 } from "lucide-react";
import { CheckIcon, CloseIcon } from "@plane/propel/icons";
import type { IWorkspaceMemberInvitation } from "@plane/types";
// components
import { LogoSpinner } from "@/components/common/logo-spinner";
import { EmptySpace, EmptySpaceItem } from "@/components/ui/empty-space";
// constants
import { WORKSPACE_INVITATION } from "@plane/constants";
// helpers
import { EPageTypes } from "@/helpers/authentication.helper";
// hooks
import { useUser } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
// wrappers
import { AuthenticationWrapper } from "@/lib/wrappers/authentication-wrapper";
import { WorkspaceService } from "@/services/workspace.service";
// services

// service initialization
const workspaceService = new WorkspaceService();

const WORKSPACE_DESCRIPTION =
  "Your workspace is where you'll create projects, collaborate on your work items, and organize different streams of work in your Plane account.";

type TWorkspaceInvitationStateProps = {
  invitationDetail: IWorkspaceMemberInvitation | undefined;
  hasError: boolean;
  isSignedIn: boolean;
  onAccept: () => void;
  onReject: () => void;
};

function WorkspaceInvitationState(props: TWorkspaceInvitationStateProps) {
  const { invitationDetail, hasError, isSignedIn, onAccept, onReject } = props;

  if (invitationDetail && !invitationDetail.responded_at) {
    if (hasError)
      return (
        <div className="flex w-full flex-col space-y-4 rounded-sm border border-subtle bg-surface-1 px-4 py-8 text-center shadow-2xl md:w-1/3">
          <h2 className="text-18 uppercase">INVITATION NOT FOUND</h2>
        </div>
      );
    return (
      <EmptySpace
        title={`You have been invited to ${invitationDetail.workspace.name}`}
        description={WORKSPACE_DESCRIPTION}
      >
        <EmptySpaceItem Icon={CheckIcon} title="Accept" action={onAccept} />
        <EmptySpaceItem Icon={CloseIcon} title="Ignore" action={onReject} />
      </EmptySpace>
    );
  }

  if (hasError || invitationDetail?.responded_at) {
    if (invitationDetail?.accepted)
      return (
        <EmptySpace
          title={`You are already a member of ${invitationDetail.workspace.name}`}
          description={WORKSPACE_DESCRIPTION}
        >
          <EmptySpaceItem Icon={Boxes} title="Continue to home" href="/" />
        </EmptySpace>
      );
    return (
      <EmptySpace
        title="This invitation link is not active anymore."
        description={WORKSPACE_DESCRIPTION}
        link={{ text: "Or start from an empty project", href: "/" }}
      >
        {!isSignedIn ? (
          <EmptySpaceItem Icon={User2} title="Sign in to continue" href="/" />
        ) : (
          <EmptySpaceItem Icon={Boxes} title="Continue to home" href="/" />
        )}
        <EmptySpaceItem Icon={Star} title="Star us on GitHub" href="https://github.com/makeplane" />
        <EmptySpaceItem Icon={Share2} title="Join our community of active creators" href="https://forum.plane.so" />
      </EmptySpace>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center">
      <LogoSpinner />
    </div>
  );
}

function WorkspaceInvitationPage() {
  // router
  const router = useAppRouter();
  // query params
  const searchParams = useSearchParams();
  const invitation_id = searchParams.get("invitation_id");
  const slug = searchParams.get("slug");
  const token = searchParams.get("token");
  // store hooks
  const { data: currentUser } = useUser();

  const { data: invitationDetail, error } = useSWR(
    invitation_id && slug && WORKSPACE_INVITATION(invitation_id.toString()),
    invitation_id && slug
      ? () => workspaceService.getWorkspaceInvitation(slug.toString(), invitation_id.toString())
      : null
  );

  const handleAccept = () => {
    if (!invitationDetail) return;
    workspaceService
      .joinWorkspace(invitationDetail.workspace.slug, invitationDetail.id, {
        accepted: true,
        token: token,
      })
      .then(() => {
        if (invitationDetail.email === currentUser?.email) {
          router.push(`/${invitationDetail.workspace.slug}`);
        } else {
          router.push("/");
        }
      })
      .catch((err: unknown) => console.error(err));
  };

  const handleReject = () => {
    if (!invitationDetail || !token) return;
    void workspaceService
      .joinWorkspace(invitationDetail.workspace.slug, invitationDetail.id, {
        accepted: false,
        token: token,
      })
      .then(() => {
        router.push("/");
      })
      .catch((err: unknown) => console.error(err));
  };

  return (
    <AuthenticationWrapper pageType={EPageTypes.PUBLIC}>
      <div className="flex h-full w-full flex-col items-center justify-center px-3">
        <WorkspaceInvitationState
          invitationDetail={invitationDetail}
          hasError={!!error}
          isSignedIn={!!currentUser}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      </div>
    </AuthenticationWrapper>
  );
}

export default observer(WorkspaceInvitationPage);
