/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { ComponentProps } from "react";
import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
import type { IProjectMemberDisplayProperties } from "@plane/constants";
import { renderFormattedDate } from "@plane/utils";
import { Table } from "@plane/ui";
import { MemberHeaderColumn } from "@/components/project/member-header-column";
import { AccountTypeColumn } from "@/components/project/settings/member-columns";
import type { ProjectMember } from "@/components/project/settings/member-columns";
import { NameColumn } from "@/components/workspace/settings/member-columns";

type MemberArgs = FunctionArgs<typeof api.projects.index.members>;
export const useProjectColumns = ({
  projectId,
  workspaceSlug,
  orderBy,
  onOrderChange,
  disabled,
  onChange,
}: {
  projectId: MemberArgs["projectId"];
  workspaceSlug: string;
  orderBy: MemberArgs["orderBy"];
  onOrderChange: (value: MemberArgs["orderBy"]) => void;
} & Pick<ComponentProps<typeof AccountTypeColumn>, "onChange" | "disabled">) => {
  const [removeMemberModal, setRemoveMemberModal] = useState<ProjectMember | null>(null);
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
  const columns: ComponentProps<typeof Table<ProjectMember>>["columns"] = [
    {
      key: "fullName",
      content: "Full name",
      thRender: () => sorting("full_name", "fullName"),
      tdRender: (member) => (
        <NameColumn
          member={member}
          workspaceSlug={workspaceSlug}
          canRemove={member.canRemove || member.canLeave}
          isSelf={member.canLeave}
          onRemove={setRemoveMemberModal}
        />
      ),
    },
    {
      key: "displayName",
      content: "Display name",
      thRender: () => sorting("display_name", "displayName"),
      tdRender: (member) => <div className="w-32">{member.displayName}</div>,
    },
    {
      key: "email",
      content: "Email",
      thRender: () => sorting("email", "email"),
      tdRender: (member) => <div className="w-48 truncate text-secondary">{member.email}</div>,
    },
    {
      key: "role",
      content: "Account type",
      thRender: () => sorting("role", "role"),
      tdRender: (member) => (
        <AccountTypeColumn member={member} projectId={projectId} onChange={onChange} disabled={disabled} />
      ),
    },
    {
      key: "joinedAt",
      content: "Joining date",
      thRender: () => sorting("joining_date", "joinedAt"),
      tdRender: (member) => <div>{renderFormattedDate(new Date(member.joinedAt))}</div>,
    },
  ];
  return { columns, removeMemberModal, setRemoveMemberModal };
};
