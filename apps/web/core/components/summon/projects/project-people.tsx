/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { SummonSearchField } from "@/components/summon/search-field";
import { EnvelopeSimpleIcon, UserPlusIcon, XIcon } from "@phosphor-icons/react";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { Avatar } from "@plane/propel/avatar";
import { Button } from "@plane/propel/button";
import { Dialog, EDialogWidth } from "@plane/propel/dialog";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { ISummonProjectPeople } from "@plane/types";
import { getFileURL } from "@plane/utils";
import { accessErrorMessage, roleLabel } from "@/components/summon/settings/roles";
import { useSummonAccess } from "@/components/summon/use-summon-access";
import { useMember } from "@/hooks/store/use-member";
import { useUserPermissions } from "@/hooks/store/user";
import { summonService } from "@/services/summon.service";

const VISIBLE_MEMBERS = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Who is on the project and who joins it on first sign-in. Project admins add workspace members;
 * workspace admins can also invite a new email straight onto this project as a guest.
 */
export const ProjectPeopleSection = observer(function ProjectPeopleSection(props: {
  workspaceSlug: string;
  projectId: string;
}) {
  const { workspaceSlug, projectId } = props;
  const [adding, setAdding] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const { allowPermissions } = useUserPermissions();
  const canInvite = useSummonAccess(workspaceSlug).can("users.manage");
  const canAdd =
    canInvite || allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT, workspaceSlug, projectId);
  const { data, mutate } = useSWR(["summon-project-people", workspaceSlug, projectId], () =>
    summonService.listProjectPeople(workspaceSlug, projectId)
  );
  const members = data?.members ?? [];
  const invites = data?.invites ?? [];
  const shown = showAll ? members : members.slice(0, VISIBLE_MEMBERS);

  const revoke = async (inviteId: string, email: string) => {
    try {
      await summonService.revokeProjectInvite(workspaceSlug, projectId, inviteId);
      await mutate();
      setToast({ type: TOAST_TYPE.SUCCESS, title: `${email} won't join this project` });
    } catch (error) {
      setToast({ type: TOAST_TYPE.ERROR, title: accessErrorMessage(error) });
    }
  };

  return (
    <section className="border-t border-subtle pt-5" aria-labelledby="project-people">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="project-people" className="text-sm font-semibold text-primary">
          People <span className="font-normal ml-1 text-xs text-secondary tabular-nums">{members.length}</span>
        </h2>
        {canAdd ? (
          <Button variant="secondary" size="sm" prependIcon={<UserPlusIcon />} onClick={() => setAdding(true)}>
            Add people
          </Button>
        ) : null}
      </div>
      {members.length ? (
        <ul className="space-y-2.5">
          {shown.map((member) => (
            <li key={member.user_id} className="flex items-center gap-2.5 text-xs">
              <Avatar size={24} name={member.name} src={getFileURL(member.avatar_url ?? "")} />
              <span className="min-w-0 flex-1 truncate text-primary" title={member.name}>
                {member.name}
              </span>
              <span className="text-tertiary">{roleLabel(member.role)}</span>
            </li>
          ))}
          {members.length > VISIBLE_MEMBERS ? (
            <li>
              <button
                type="button"
                onClick={() => setShowAll((value) => !value)}
                aria-expanded={showAll}
                className="rounded text-xs text-secondary hover:text-primary"
              >
                {showAll ? "Show fewer" : `Show all ${members.length}`}
              </button>
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="text-xs text-secondary">No one on this project yet.</p>
      )}
      {invites.length ? (
        <ul
          className="mt-3 space-y-2.5 border-t border-dashed border-subtle pt-3"
          aria-label="Joining on first sign-in"
        >
          {invites.map((invite) => (
            <li key={invite.id} className="flex items-center gap-2.5 text-xs">
              <span className="grid size-6 flex-none place-items-center rounded-full border border-dashed border-strong text-tertiary">
                <EnvelopeSimpleIcon className="size-3" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-primary">{invite.email}</span>
                <span className="block text-tertiary">Joins on first sign-in · {roleLabel(invite.role)}</span>
              </span>
              {canAdd ? (
                <button
                  type="button"
                  onClick={() => void revoke(invite.id, invite.email)}
                  aria-label={`Cancel ${invite.email}'s invite to this project`}
                  className="grid size-7 place-items-center rounded-md text-tertiary hover:bg-layer-1 hover:text-primary"
                >
                  <XIcon className="size-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {canAdd && data ? (
        <AddPeopleDialog
          open={adding}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          people={data}
          canInvite={canInvite}
          onClose={() => setAdding(false)}
          onAdded={(next) => void mutate(next, { revalidate: false })}
        />
      ) : null}
    </section>
  );
});

/** One search box: pick a workspace member to add, or type a new email to invite as a guest. */
const AddPeopleDialog = observer(function AddPeopleDialog(props: {
  open: boolean;
  workspaceSlug: string;
  projectId: string;
  people: ISummonProjectPeople;
  canInvite: boolean;
  onClose: () => void;
  onAdded: (people: ISummonProjectPeople) => void;
}) {
  const { open, workspaceSlug, projectId, people, canInvite, onClose, onAdded } = props;
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const {
    workspace: { workspaceMemberIds, getWorkspaceMemberDetails },
  } = useMember();

  const needle = query.trim().toLowerCase();
  const onProject = new Set(people.members.map((member) => member.user_id));
  const candidates = (workspaceMemberIds ?? []).flatMap((userId) => {
    const details = getWorkspaceMemberDetails(userId);
    if (!details || details.is_active === false || details.member.is_bot || onProject.has(userId)) return [];
    const { member } = details;
    const name = member.display_name || `${member.first_name} ${member.last_name}`.trim() || member.email || "";
    const haystack = `${name} ${member.email ?? ""}`.toLowerCase();
    return !needle || haystack.includes(needle) ? [{ userId, name, member, role: details.role }] : [];
  });
  const knownEmails = new Set([
    ...people.members.map((member) => member.email.toLowerCase()),
    ...people.invites.map((invite) => invite.email.toLowerCase()),
    ...candidates.flatMap(({ member }) => (member.email ? [member.email.toLowerCase()] : [])),
  ]);
  const newEmail = EMAIL_PATTERN.test(needle) && !knownEmails.has(needle) ? needle : null;

  const close = () => {
    setQuery("");
    setError("");
    onClose();
  };

  const add = async (key: string, payload: { member_id: string } | { email: string }, title: string) => {
    setPending(key);
    setError("");
    try {
      onAdded(await summonService.addProjectPerson(workspaceSlug, projectId, payload));
      setToast({ type: TOAST_TYPE.SUCCESS, title });
      setQuery("");
    } catch (requestError) {
      setError(accessErrorMessage(requestError));
    } finally {
      setPending(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <Dialog.Panel
        width={EDialogWidth.MD}
        initialFocus={searchRef}
        className="w-[calc(100vw-2rem)] overflow-hidden rounded-xl"
      >
        <header className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <Dialog.Title className="text-16 font-semibold text-primary">Add people</Dialog.Title>
            <p className="mt-1 text-13 text-secondary">
              {canInvite
                ? "Pick someone from the workspace, or type a new email to invite them as a guest."
                : "Pick someone from the workspace."}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="-mt-1 -mr-2 grid size-9 place-items-center rounded-lg text-tertiary hover:bg-layer-1 hover:text-primary"
          >
            <XIcon className="size-4" />
          </button>
        </header>

        <div className="grid gap-3 px-5 py-4">
          <SummonSearchField
            ref={searchRef}
            label="Name or email"
            placeholder={canInvite ? "Name or email" : "Search workspace members"}
            value={query}
            onValueChange={setQuery}
          />

          <ul className="vertical-scrollbar grid scrollbar-sm max-h-72 gap-0.5 overflow-y-auto" aria-label="People">
            {newEmail && canInvite ? (
              <PersonOption
                avatar={
                  <span className="grid size-7 flex-none place-items-center rounded-full border border-dashed border-strong text-tertiary">
                    <EnvelopeSimpleIcon className="size-3.5" />
                  </span>
                }
                name={newEmail}
                detail="New to the workspace · joins as a guest"
                action="Invite"
                loading={pending === newEmail}
                onSelect={() => void add(newEmail, { email: newEmail }, `${newEmail} invited as a guest`)}
              />
            ) : null}
            {candidates.map(({ userId, name, member, role }) => (
              <PersonOption
                key={userId}
                avatar={<Avatar size={28} name={name} src={getFileURL(member.avatar_url ?? "")} />}
                name={name}
                detail={[member.email, roleLabel(role)].filter(Boolean).join(" · ")}
                action="Add"
                loading={pending === userId}
                onSelect={() => void add(userId, { member_id: userId }, `${name} added to the project`)}
              />
            ))}
          </ul>
          {!candidates.length && !(newEmail && canInvite) ? (
            <p className="px-1 text-13 text-tertiary">
              {newEmail
                ? "Only workspace admins can invite someone new."
                : needle
                  ? "No one in the workspace matches."
                  : "Everyone in the workspace is already on this project."}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-13 text-danger-primary">
              {error}
            </p>
          ) : null}
        </div>
      </Dialog.Panel>
    </Dialog>
  );
});

function PersonOption(props: {
  avatar: React.ReactNode;
  name: string;
  detail: string;
  action: string;
  loading: boolean;
  onSelect: () => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-layer-1">
      {props.avatar}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-13 font-medium text-primary" title={props.name}>
          {props.name}
        </span>
        <span className="block truncate text-12 text-tertiary">{props.detail}</span>
      </span>
      <Button variant="secondary" size="sm" loading={props.loading} onClick={props.onSelect}>
        {props.action}
      </Button>
    </li>
  );
}
