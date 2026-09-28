/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Link, useOutletContext } from "react-router";
import { useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
import { WORKSPACE_SETTINGS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { SearchIcon } from "@plane/propel/icons";
import { CountChip } from "@/components/common/count-chip";
import { PageHead } from "@/components/core/page-title";
import { MemberListFiltersDropdown } from "@/components/project/dropdowns/filters/member-list";
import { WorkspaceMembersList } from "@/components/workspace/settings/members-list";
import { SendWorkspaceInvitationModal } from "@/components/workspace/members";
import { MembersSettingsLoader } from "@/components/ui/loader/settings/members";
import { PreservedWorkspaceSettingsShell } from "@/components/workspace/native-shell/workspace-shell";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import type { WorkspaceSession } from "../../../../../../native-workspace";
import type { Route } from "./+types/page";
import { MembersWorkspaceSettingsHeader } from "./header";

type MemberArgs = FunctionArgs<typeof api.workspaces.index.members>;

export default function WorkspaceMembersSettingsPage() {
  const session = useOutletContext<WorkspaceSession>();
  const { user, workspace } = session;
  const { t } = useTranslation();
  const commands = useStickiesCommands();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [roles, setRoles] = useState<NonNullable<MemberArgs["roles"]>>([]);
  const [orderBy, setOrderBy] = useState<MemberArgs["orderBy"]>();
  const isAdmin = workspace.membershipRole === "admin";
  const scope = { workspaceId: workspace._id, projectId: null };
  const directory = useQuery(
    api.workspaces.index.members,
    workspace.membershipRole === "guest" ? "skip" : { workspaceId: workspace._id, search, roles, orderBy }
  );
  return (
    <>
      <PageHead title={`${workspace.name} - Members`} />
      <PreservedWorkspaceSettingsShell
        {...session}
        activePath={WORKSPACE_SETTINGS.members.i18n_label}
        header={<MembersWorkspaceSettingsHeader />}
        hugging
      >
        {inviteOpen && isAdmin && <SendWorkspaceInvitationModal scope={scope} onClose={() => setInviteOpen(false)} />}
        <section className="size-full">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-3.5">
            <h4 className="flex items-center gap-2.5 text-h3-medium">
              {t("workspace_settings.settings.members.title")}
              {directory && directory.totalCount > 0 && (
                <CountChip count={directory.totalCount} className="m-auto h-5" />
              )}
            </h4>
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex min-w-0 items-center gap-1.5 rounded-md border border-subtle bg-surface-1 px-2.5 py-1.5">
                <SearchIcon className="size-3.5 shrink-0 text-placeholder" aria-hidden="true" />
                <input
                  className="w-full max-w-[234px] min-w-0 border-none bg-transparent text-body-xs-regular outline-none placeholder:text-placeholder"
                  aria-label="Search members and pending invitations"
                  placeholder={`${t("search")}...`}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              {directory && (
                <MemberListFiltersDropdown<NonNullable<MemberArgs["roles"]>[number]>
                  appliedFilters={roles}
                  handleUpdate={(role) =>
                    setRoles((current) =>
                      current.includes(role) ? current.filter((entry) => entry !== role) : [...current, role]
                    )
                  }
                  options={[
                    ...directory.roles.map((role) => ({ value: role, label: t(`role_details.${role}.title`) })),
                    { value: "suspended", label: "Suspended" },
                  ]}
                />
              )}
              {isAdmin && (
                <Button variant="primary" size="lg" onClick={() => setInviteOpen(true)}>
                  {t("workspace_settings.settings.members.add_member")}
                </Button>
              )}
            </div>
          </div>
          {directory === undefined ? (
            <MembersSettingsLoader />
          ) : (
            <WorkspaceMembersList
              members={directory.members}
              roles={directory.roles}
              workspace={workspace}
              currentUserId={user.id}
              orderBy={orderBy}
              onOrderChange={setOrderBy}
              beforeLeave={commands.flushAll}
              searchQuery={search}
            />
          )}
        </section>
      </PreservedWorkspaceSettingsShell>
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const session = useOutletContext<WorkspaceSession>();
  return (
    <>
      <PageHead title={`${session.workspace.name} - Members`} />
      <PreservedWorkspaceSettingsShell
        {...session}
        activePath={WORKSPACE_SETTINGS.members.i18n_label}
        header={<MembersWorkspaceSettingsHeader />}
        hugging
      >
        <section className="space-y-4">
          <h1 className="text-h3-medium">Members are unavailable</h1>
          <p role="alert" className="text-body-xs-regular text-danger-primary">
            {mutationMessage(error)}
          </p>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Reload directory
            </Button>
            <Link className="text-link-primary" to="/">
              Choose an available workspace
            </Link>
          </div>
        </section>
      </PreservedWorkspaceSettingsShell>
    </>
  );
}
