/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { CircleMinus } from "lucide-react";
// plane imports
import { ROLE, EUserPermissions, MEMBER_TRACKER_ELEMENTS } from "@plane/constants";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { EUserProjectRoles } from "@plane/types";
import type { IUser, IWorkspaceMember, TProjectMembership } from "@plane/types";
import { CustomMenu, CustomSelect } from "@plane/ui";
import { getFileURL } from "@plane/utils";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useUser, useUserPermissions } from "@/hooks/store/user";

export interface RowData extends Pick<TProjectMembership, "original_role"> {
  member: IWorkspaceMember;
}

type NameProps = {
  rowData: RowData;
  workspaceSlug: string;
  isAdmin: boolean;
  currentUser: IUser | undefined;
  setRemoveMemberModal: (rowData: RowData) => void;
};

type AccountTypeProps = {
  rowData: RowData;
  currentProjectRole: EUserPermissions | undefined;
  workspaceSlug: string;
  projectId: string;
};

export function NameColumn(props: NameProps) {
  const { rowData, workspaceSlug, isAdmin, currentUser, setRemoveMemberModal } = props;
  // derived values
  const { avatar_url, display_name, email, first_name, id, last_name } = rowData.member;

  return (
    <div className="group relative">
      <div className="flex w-72 items-center gap-2">
        <div className="flex flex-1 items-center gap-x-2 gap-y-2">
          {avatar_url && avatar_url.trim() !== "" ? (
            <Link href={`/${workspaceSlug}/profile/${id}`}>
              <span className="relative flex size-6 items-center justify-center rounded-full text-on-color capitalize">
                <img
                  src={getFileURL(avatar_url)}
                  className="absolute top-0 left-0 h-full w-full rounded-full object-cover"
                  alt={display_name || email}
                />
              </span>
            </Link>
          ) : (
            <Link href={`/${workspaceSlug}/profile/${id}`}>
              <span className="relative flex size-6 items-center justify-center rounded-full bg-layer-3 text-11 text-on-color capitalize">
                {(email ?? display_name ?? "?")[0]}
              </span>
            </Link>
          )}
          {first_name} {last_name}
        </div>
        {(isAdmin || id === currentUser?.id) && (
          <CustomMenu
            ellipsis
            buttonClassName="p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            optionsClassName="p-1.5"
            placement="bottom-end"
          >
            <CustomMenu.MenuItem onClick={() => setRemoveMemberModal(rowData)}>
              <div
                className="flex cursor-pointer items-center gap-x-1 font-medium text-danger-primary"
                data-ph-element={MEMBER_TRACKER_ELEMENTS.PROJECT_MEMBER_TABLE_CONTEXT_MENU}
              >
                <CircleMinus className="size-3.5 flex-shrink-0" />
                {rowData.member?.id === currentUser?.id ? "Leave " : "Remove "}
              </div>
            </CustomMenu.MenuItem>
          </CustomMenu>
        )}
      </div>
    </div>
  );
}

export const AccountTypeColumn = observer(function AccountTypeColumn(props: AccountTypeProps) {
  const { rowData, projectId, workspaceSlug } = props;
  // store hooks
  const {
    project: { updateMemberRole },
    workspace: { getWorkspaceMemberDetails },
  } = useMember();
  const { data: currentUser } = useUser();
  const { getProjectRoleByWorkspaceSlugAndProjectId } = useUserPermissions();
  // form info
  const {
    control,
    formState: { errors },
  } = useForm();
  // derived values
  const roleLabel = ROLE[rowData.original_role ?? EUserPermissions.GUEST];
  const isCurrentUser = currentUser?.id === rowData.member.id;
  const workspaceRole = getWorkspaceMemberDetails(rowData.member.id)?.role;
  const isRowDataWorkspaceAdmin = workspaceRole === EUserPermissions.ADMIN;
  const isCurrentUserWorkspaceAdmin = currentUser
    ? getWorkspaceMemberDetails(currentUser.id)?.role === EUserPermissions.ADMIN
    : false;
  const currentProjectRole = getProjectRoleByWorkspaceSlugAndProjectId(workspaceSlug, projectId);

  const isCurrentUserProjectAdmin = currentProjectRole === EUserPermissions.ADMIN;

  // logic
  // Workspace admin can change his own role
  // Project admin can change any role except his own and workspace admin's role
  const isRoleEditable =
    (isCurrentUserWorkspaceAdmin && isCurrentUser) ||
    (isCurrentUserProjectAdmin && !isRowDataWorkspaceAdmin && !isCurrentUser);
  return (
    <>
      {isRoleEditable ? (
        <Controller
          name="role"
          control={control}
          rules={{ required: "Role is required." }}
          render={() => (
            <CustomSelect
              value={rowData.original_role}
              onChange={async (value) => {
                if (value === null || !workspaceSlug) return;
                await updateMemberRole(workspaceSlug.toString(), projectId.toString(), rowData.member.id, value).catch(
                  (err) => {
                    console.log(err, "err");
                    const error = err.error;
                    const errorString = Array.isArray(error) ? error[0] : error;

                    setToast({
                      type: TOAST_TYPE.ERROR,
                      title: "You can’t change this role yet.",
                      message: errorString ?? "An error occurred while updating member role. Please try again.",
                    });
                  }
                );
              }}
              label={
                <div className="flex">
                  <span>{roleLabel}</span>
                </div>
              }
              buttonClassName={`!px-0 !justify-start hover:bg-surface-1 ${errors.role ? "border-danger-strong" : "border-none"}`}
              className="w-32 rounded-md p-0"
              input
            >
              {Object.values(EUserProjectRoles)
                .filter((role) => typeof role === "number")
                // oxlint-disable-next-line unicorn/no-array-sort -- Preserve numeric role order on this private enum list; web targets ES2020.
                .sort((a, b) => a - b)
                .filter((role) => workspaceRole !== EUserPermissions.GUEST || role === EUserProjectRoles.GUEST)
                .map((role) => (
                  <CustomSelect.Option key={role} value={role}>
                    {ROLE[role]}
                  </CustomSelect.Option>
                ))}
            </CustomSelect>
          )}
        />
      ) : (
        <div className="flex w-32">
          <span>{roleLabel}</span>
        </div>
      )}
    </>
  );
});
