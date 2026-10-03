/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { ComponentProps } from "react";
import { useNavigate } from "react-router";
import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { LOGIN_MEDIUM_LABELS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { renderFormattedDate } from "@plane/utils";
import { Table } from "@plane/ui";
import type { IProjectMemberDisplayProperties } from "@plane/constants";
import { MemberHeaderColumn } from "@/components/project/member-header-column";
import { ConfirmWorkspaceMemberRemove } from "@/components/workspace/confirm-workspace-member-remove";
import type { NativeWorkspace, NativeProfile } from "@/components/workspace/native-shell/types";
import { NameColumn, AccountTypeColumn } from "./member-columns";
import type { WorkspaceMember } from "./member-columns";

type MemberArgs = FunctionArgs<typeof api.workspaces.index.members>;
type Props = {
  members: FunctionReturnType<typeof api.workspaces.index.members>["members"];
  roles: FunctionReturnType<typeof api.workspaces.index.members>["roles"];
  workspace: NativeWorkspace;
  currentUserId: NativeProfile["id"];
  orderBy: MemberArgs["orderBy"];
  onOrderChange: (orderBy: MemberArgs["orderBy"]) => void;
  beforeLeave: () => Promise<void>;
};

export function WorkspaceMembersListItem({
  members,
  roles,
  workspace,
  currentUserId,
  orderBy,
  onOrderChange,
  beforeLeave,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const revoke = useMutation(api.workspaces.index.revokeMember);
  const leave = useMutation(api.workspaces.index.leave);
  const [selection, setSelection] = useState<WorkspaceMember | null>(null);
  const isAdmin = workspace.membershipRole === "admin";
  const sorting = (
    property: keyof IProjectMemberDisplayProperties,
    field: NonNullable<MemberArgs["orderBy"]>["field"]
  ) => (
    <MemberHeaderColumn
      property={property}
      direction={orderBy?.field === field ? orderBy.direction : undefined}
      onOrderChange={(direction) => onOrderChange(direction ? { field, direction } : undefined)}
    />
  );
  const columns: ComponentProps<typeof Table<WorkspaceMember>>["columns"] = [
    {
      key: "fullName",
      content: t("workspace_settings.settings.members.details.full_name"),
      thRender: () => sorting("full_name", "fullName"),
      tdRender: (member) => (
        <NameColumn
          member={member}
          workspaceSlug={workspace.slug}
          canRemove={isAdmin || member.userId === currentUserId}
          isSelf={member.userId === currentUserId}
          onRemove={setSelection}
        />
      ),
    },
    {
      key: "displayName",
      content: t("workspace_settings.settings.members.details.display_name"),
      thRender: () => sorting("display_name", "displayName"),
      tdRender: (member) => (
        <div className={`w-32 ${member.active ? "" : "text-placeholder"}`}>{member.displayName}</div>
      ),
    },
    {
      key: "email",
      content: t("workspace_settings.settings.members.details.email_address"),
      thRender: () => sorting("email", "email"),
      tdRender: (member) => (
        <div className={`w-48 truncate ${member.active ? "" : "text-placeholder"}`}>{member.email}</div>
      ),
    },
    {
      key: "role",
      content: t("workspace_settings.settings.members.details.account_type"),
      thRender: () => sorting("role", "role"),
      tdRender: (member) => (
        <div className="w-32">
          <AccountTypeColumn
            member={member}
            workspaceId={workspace._id}
            roles={roles}
            editable={isAdmin && member.userId !== currentUserId}
          />
        </div>
      ),
    },
    {
      key: "authentication",
      content: t("workspace_settings.settings.members.details.authentication"),
      tdRender: (member) => (member.active && member.loginMethod ? LOGIN_MEDIUM_LABELS[member.loginMethod] : null),
    },
    {
      key: "joinedAt",
      content: t("workspace_settings.settings.members.details.joining_date"),
      thRender: () => sorting("joining_date", "joinedAt"),
      tdRender: (member) => (member.active ? renderFormattedDate(new Date(member.joinedAt)) : null),
    },
  ];
  return (
    <div className="grid border-t border-subtle">
      {selection && (
        <ConfirmWorkspaceMemberRemove
          kind={selection.userId === currentUserId ? "leave" : "member"}
          displayName={selection.displayName}
          onClose={() => setSelection(null)}
          onSubmit={async () => {
            if (selection.userId === currentUserId) {
              await beforeLeave();
              await leave({ workspaceId: workspace._id });
              navigate("/");
            } else await revoke({ workspaceId: workspace._id, userId: selection.userId });
          }}
        />
      )}
      <Table<WorkspaceMember>
        columns={columns}
        data={members}
        keyExtractor={(member) => member.membershipId}
        tHeadClassName="border-b border-subtle"
        thClassName="text-left font-medium divide-x-0 text-placeholder"
        tBodyClassName="divide-y-0"
        tBodyTrClassName="divide-x-0 p-4 h-10 text-secondary"
        tHeadTrClassName="divide-x-0"
      />
    </div>
  );
}
