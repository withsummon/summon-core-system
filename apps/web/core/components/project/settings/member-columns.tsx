/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import { CustomSelect } from "@plane/ui";

export type ProjectMember = FunctionReturnType<typeof api.projects.index.members>["members"][number];
export function AccountTypeColumn({
  member,
  projectId,
  disabled,
  onChange,
}: {
  member: ProjectMember;
  projectId: FunctionArgs<typeof api.projects.index.grantMember>["projectId"];
  disabled: boolean;
  onChange: (args: FunctionArgs<typeof api.projects.index.grantMember>) => Promise<void>;
}) {
  const { t } = useTranslation();
  const label = t(`role_details.${member.role}.title`);
  if (!member.allowedRoles.length) return <span>{label}</span>;
  return (
    <CustomSelect<ProjectMember["role"]>
      value={member.role}
      disabled={disabled}
      ariaLabel={`Account type for ${member.displayName ?? member.fullName}`}
      onChange={(role) => onChange({ projectId, userId: member.userId, expectedRevision: member.revision, role })}
      label={<span>{label}</span>}
      buttonClassName="!px-0 !justify-start hover:bg-surface-1 border-none"
      className="w-32 rounded-md p-0"
      input
    >
      {member.allowedRoles.map((role) => (
        <CustomSelect.Option key={role} value={role}>
          {t(`role_details.${role}.title`)}
        </CustomSelect.Option>
      ))}
    </CustomSelect>
  );
}
