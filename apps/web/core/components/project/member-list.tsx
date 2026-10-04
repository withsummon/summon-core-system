/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { ComponentProps } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { SearchIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { AccountTypeColumn } from "./settings/member-columns";
import { MembersSettingsLoader } from "@/components/ui/loader/settings/members";
import { MemberListFiltersDropdown } from "./dropdowns/filters/member-list";
import { ProjectMemberListItem } from "./member-list-item";
import { SendProjectInvitationModal } from "./send-project-invitation-modal";

type MemberArgs = FunctionArgs<typeof api.projects.index.members>;
type Props = Pick<
  ComponentProps<typeof ProjectMemberListItem>,
  "projectId" | "workspaceSlug" | "projectName" | "beforeLeave"
>;
export function ProjectMemberList(props: Props) {
  const { t } = useTranslation();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [roles, setRoles] = useState<NonNullable<MemberArgs["roles"]>>([]);
  const [orderBy, setOrderBy] = useState<MemberArgs["orderBy"]>();
  const directory = useQuery(api.projects.index.members, { projectId: props.projectId, search, roles, orderBy });
  const grant = useMutation(api.projects.index.grantMember);
  const [pending, setPending] = useState(false);
  useReloadConfirmations(pending, "The project role change is still being saved.", undefined, pending);
  const changeRole: ComponentProps<typeof AccountTypeColumn>["onChange"] = async (args) => {
    if (pending) return;
    setPending(true);
    try {
      await grant(args);
    } catch (failure) {
      setToast({ type: TOAST_TYPE.ERROR, title: "Unable to update member role", message: mutationMessage(failure) });
    } finally {
      setPending(false);
    }
  };
  return (
    <>
      {inviteOpen && (
        <SendProjectInvitationModal
          projectId={props.projectId}
          canManage={directory?.canManage === true}
          onClose={() => setInviteOpen(false)}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-subtle py-2">
        <div className="text-14 font-semibold">{t("common.members")}</div>
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 items-center gap-1.5 rounded-md border border-subtle bg-surface-1 px-2 py-1">
            <SearchIcon className="size-3.5 shrink-0" aria-hidden="true" />
            <input
              className="w-full max-w-[234px] min-w-0 border-none bg-transparent text-13 placeholder:text-placeholder focus:outline-none"
              aria-label="Search project members"
              placeholder="Search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <MemberListFiltersDropdown<NonNullable<MemberArgs["roles"]>[number]>
            appliedFilters={roles}
            handleUpdate={(role) =>
              setRoles((current) =>
                current.includes(role) ? current.filter((entry) => entry !== role) : [...current, role]
              )
            }
            options={
              directory ? directory.roles.map((role) => ({ value: role, label: t(`role_details.${role}.title`) })) : []
            }
          />
          {directory?.canManage && (
            <Button variant="primary" onClick={() => setInviteOpen(true)}>
              {t("add_member")}
            </Button>
          )}
        </div>
      </div>
      {directory === undefined ? (
        <MembersSettingsLoader />
      ) : (
        <div className="overflow-x-auto">
          <ProjectMemberListItem
            {...props}
            members={directory.members}
            orderBy={orderBy}
            onOrderChange={setOrderBy}
            onChange={changeRole}
            disabled={pending}
          />
          {directory.members.length === 0 && (
            <h4 className="mt-16 text-center text-13 text-placeholder">{t("no_matching_members")}</h4>
          )}
        </div>
      )}
    </>
  );
}
