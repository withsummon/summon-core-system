/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { ComponentProps } from "react";
import { useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import { ChevronDownIcon } from "@plane/propel/icons";
import { Collapsible } from "@plane/ui";
import { CountChip } from "@/components/common/count-chip";
import { MembersSettingsLoader } from "@/components/ui/loader/settings/members";
import { WorkspaceInvitationsListItem } from "./invitations-list-item";
import { WorkspaceMembersListItem } from "./members-list-item";

type Props = ComponentProps<typeof WorkspaceMembersListItem> & { searchQuery: string };

export function WorkspaceMembersList({ searchQuery, ...members }: Props) {
  const { t } = useTranslation();
  const isAdmin = members.workspace.membershipRole === "admin";
  return (
    <>
      <div className="divide-y-[0.5px] divide-subtle overflow-x-auto">
        {members.members.length > 0 && <WorkspaceMembersListItem {...members} />}
        {!isAdmin && members.members.length === 0 && (
          <h4 className="mt-16 text-center text-body-xs-regular text-placeholder">{t("no_matching_members")}</h4>
        )}
      </div>
      {isAdmin && (
        <WorkspacePendingInvitations
          workspaceId={members.workspace._id}
          projectId={null}
          search={searchQuery}
          memberCount={members.members.length}
        />
      )}
    </>
  );
}

function WorkspacePendingInvitations({
  memberCount,
  ...scope
}: FunctionArgs<typeof api.invitations.index.pending> & { memberCount: number }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const invitations = useQuery(api.invitations.index.pending, scope);
  const access = useQuery(api.invitations.index.access, { workspaceId: scope.workspaceId, projectId: scope.projectId });
  const availability = useQuery(api.invitations.index.availability, {});
  if (invitations === undefined || access === undefined || availability === undefined) return <MembersSettingsLoader />;
  if (invitations.length === 0)
    return memberCount === 0 ? (
      <h4 className="mt-16 text-center text-body-xs-regular text-placeholder">{t("no_matching_members")}</h4>
    ) : null;
  return (
    <Collapsible
      isOpen={expanded}
      onToggle={() => setExpanded(!expanded)}
      buttonClassName="w-full"
      title={
        <div className="flex w-full items-center justify-between pt-4">
          <div className="flex">
            <h4 className="py-2 text-h5-medium">{t("workspace_settings.settings.members.pending_invites")}</h4>
            <CountChip count={invitations.length} className="m-auto ml-2 h-5" />
          </div>
          <ChevronDownIcon
            className={`size-5 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </div>
      }
    >
      <div className="ml-auto items-center gap-1.5 rounded-md bg-surface-1 py-1.5">
        {invitations.map((invitation) => (
          <WorkspaceInvitationsListItem
            key={invitation._id}
            invitation={invitation}
            roles={access.roles}
            emailDelivery={availability.emailDelivery}
          />
        ))}
      </div>
    </Collapsible>
  );
}
