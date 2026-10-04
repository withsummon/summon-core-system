/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import { TrashIcon, SuspendedUserIcon } from "@plane/propel/icons";
import { Pill, EPillVariant, EPillSize } from "@plane/propel/pill";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Avatar, CustomSelect, CustomMenu } from "@plane/ui";
import { AuthenticatedAssetImage } from "@/components/convex-core/assets/image";
import { mutationMessage } from "@/components/convex-core/commercial/forms";

export type WorkspaceMember = FunctionReturnType<typeof api.workspaces.index.members>["members"][number];

type NameProps<T extends Pick<WorkspaceMember, "active" | "avatar" | "userId" | "displayName" | "fullName">> = {
  member: T;
  workspaceSlug: string;
  canRemove: boolean;
  isSelf: boolean;
  onRemove: (member: T) => void;
};

export function NameColumn<
  T extends Pick<WorkspaceMember, "active" | "avatar" | "userId" | "displayName" | "fullName">,
>({ member, workspaceSlug, canRemove, isSelf, onRemove }: NameProps<T>) {
  const { t } = useTranslation();
  return (
    <div className="group relative">
      <div className="flex w-72 items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-1 items-center gap-x-2 gap-y-2">
          {!member.active ? (
            <div className="rounded-full bg-layer-1">
              <SuspendedUserIcon className="size-6 text-placeholder" aria-hidden="true" />
            </div>
          ) : (
            <Link
              href={`/${workspaceSlug}/profile/${member.userId}`}
              aria-label={`View member profile: ${member.displayName ?? member.userId}`}
            >
              {member.avatar ? (
                <span className="relative flex size-6 items-center justify-center overflow-hidden rounded-full">
                  <AuthenticatedAssetImage
                    asset={member.avatar}
                    alt="Member avatar"
                    className="absolute inset-0 size-full rounded-full object-cover"
                  />
                </span>
              ) : (
                <Avatar
                  name={member.displayName ?? member.fullName}
                  size={24}
                  shape="circle"
                  showTooltip={false}
                  className="bg-layer-3 text-11 text-tertiary"
                />
              )}
            </Link>
          )}
          <span className={member.active ? "" : "text-placeholder"}>{member.fullName}</span>
        </div>
        {member.active && canRemove && (
          <CustomMenu
            verticalEllipsis
            ariaLabel="Member actions"
            placement="bottom-end"
            closeOnSelect
            buttonClassName="size-8 shrink-0 md:opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[popup-open]:opacity-100"
          >
            <CustomMenu.MenuItem onClick={() => onRemove(member)}>
              <TrashIcon className="size-3.5" aria-hidden="true" />
              {t(isSelf ? "leave" : "remove")}
            </CustomMenu.MenuItem>
          </CustomMenu>
        )}
      </div>
    </div>
  );
}

type AccountTypeProps = {
  member: WorkspaceMember;
  workspaceId: FunctionArgs<typeof api.workspaces.index.changeMemberRole>["workspaceId"];
  roles: FunctionReturnType<typeof api.workspaces.index.members>["roles"];
  editable: boolean;
};

export function AccountTypeColumn({ member, workspaceId, roles, editable }: AccountTypeProps) {
  const { t } = useTranslation();
  const changeRole = useMutation(api.workspaces.index.changeMemberRole);
  const [pending, setPending] = useState(false);
  if (!member.active)
    return (
      <Pill variant={EPillVariant.DEFAULT} size={EPillSize.SM} className="border-none">
        Suspended
      </Pill>
    );
  const label = t(`role_details.${member.role}.title`);
  if (!editable) return <span>{label}</span>;
  return (
    <CustomSelect<WorkspaceMember["role"]>
      value={member.role}
      disabled={pending}
      ariaLabel={`Account type for ${member.displayName ?? member.userId}`}
      onChange={async (role) => {
        setPending(true);
        try {
          await changeRole({ workspaceId, membershipId: member.membershipId, expectedRole: member.role, role });
        } catch (failure) {
          setToast({
            type: TOAST_TYPE.ERROR,
            title: "Unable to update member role",
            message: mutationMessage(failure),
          });
        } finally {
          setPending(false);
        }
      }}
      label={<span>{label}</span>}
      buttonClassName="!px-0 !justify-start hover:bg-surface-1 border-none"
      className="w-32 rounded-md p-0"
      input
    >
      {roles.map((role) => (
        <CustomSelect.Option key={role} value={role}>
          {t(`role_details.${role}.title`)}
        </CustomSelect.Option>
      ))}
    </CustomSelect>
  );
}
