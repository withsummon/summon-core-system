/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  ArrowCounterClockwiseIcon,
  CheckCircleIcon,
  ClockIcon,
  EnvelopeSimpleIcon,
  LockSimpleIcon,
  MagnifyingGlassIcon,
  ProhibitIcon,
  UserCircleIcon,
  UserMinusIcon,
  UsersThreeIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { Avatar } from "@plane/propel/avatar";
import { Badge } from "@plane/propel/badge";
import type { TBadgeVariant } from "@plane/propel/badge";
import { Chip } from "@plane/propel/chip";
import { FIELD_CLASSNAME } from "@plane/propel/input";
import { Menu } from "@plane/propel/menu";
import { Select } from "@plane/propel/select";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { ISummonWorkspaceInvite, ISummonWorkspaceUser, TSummonRole } from "@plane/types";
import { AlertModalCore } from "@plane/ui";
import { calculateTimeAgo, getFileURL } from "@plane/utils";
import { SummonRequestState } from "@/components/summon/request-state";
import { summonService } from "@/services/summon.service";
import { AccessHistory } from "./access-history";
import { ROLE_OPTIONS, accessErrorMessage, roleLabel } from "./roles";

type TStatus = "active" | "invited" | "deactivated";
type TFilter = "all" | TStatus;
type TRow =
  | { kind: "member"; status: TStatus; member: ISummonWorkspaceUser }
  | { kind: "invite"; status: "invited"; invite: ISummonWorkspaceInvite };
type TConfirm = { title: string; content: string; action: string; run: () => Promise<unknown> };

const STATUS: Record<TStatus, { label: string; icon: Icon; variant: TBadgeVariant }> = {
  active: { label: "Active", icon: CheckCircleIcon, variant: "success" },
  invited: { label: "Invited", icon: ClockIcon, variant: "neutral" },
  deactivated: { label: "Deactivated", icon: ProhibitIcon, variant: "danger" },
};

const FILTERS: { value: TFilter; label: string; icon: typeof UsersThreeIcon }[] = [
  { value: "all", label: "All", icon: UsersThreeIcon },
  { value: "active", label: "Active", icon: CheckCircleIcon },
  { value: "invited", label: "Invited", icon: EnvelopeSimpleIcon },
  { value: "deactivated", label: "Deactivated", icon: ProhibitIcon },
];

/** Everyone with access to the workspace, pending invites included, and how their access changed. */
export function SummonUsersRoot(props: { workspaceSlug: string }) {
  const { workspaceSlug } = props;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TFilter>("all");
  const [confirm, setConfirm] = useState<TConfirm | null>(null);
  const [busy, setBusy] = useState(false);
  const users = useSWR(["summon-users", workspaceSlug], () => summonService.listUsers(workspaceSlug));
  const history = useSWR(["summon-access-history", workspaceSlug], () =>
    summonService.listAccessHistory(workspaceSlug)
  );

  const rows = useMemo<TRow[]>(() => {
    if (!users.data) return [];
    return [
      ...users.data.members.map(
        (member): TRow => ({ kind: "member", status: member.is_active ? "active" : "deactivated", member })
      ),
      ...users.data.invites.map((invite): TRow => ({ kind: "invite", status: "invited", invite })),
    ];
  }, [users.data]);

  const counts = useMemo(() => {
    const result: Record<TFilter, number> = { all: rows.length, active: 0, invited: 0, deactivated: 0 };
    rows.forEach((row) => (result[row.status] += 1));
    return result;
  }, [rows]);

  const needle = query.trim().toLowerCase();
  const visible = rows.filter((row) => {
    if (filter !== "all" && row.status !== filter) return false;
    if (!needle) return true;
    const text = row.kind === "member" ? `${row.member.name} ${row.member.email}` : row.invite.email;
    return text.toLowerCase().includes(needle);
  });

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      setToast({ type: TOAST_TYPE.SUCCESS, title: success });
    } catch (error) {
      setToast({ type: TOAST_TYPE.ERROR, title: "Access not changed", message: accessErrorMessage(error) });
    } finally {
      await Promise.all([users.mutate(), history.mutate()]);
    }
  };

  const confirmAndRun = async () => {
    if (!confirm) return;
    setBusy(true);
    await run(confirm.run, confirm.action);
    setBusy(false);
    setConfirm(null);
  };

  if (!users.data)
    return <SummonRequestState loading={users.isLoading} error={users.error} onRetry={() => void users.mutate()} />;

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Search people</span>
          <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tertiary" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or email"
            className={`${FIELD_CLASSNAME} h-9 w-full pr-3 pl-9`}
          />
        </label>
        <div
          className="flex gap-1.5 max-sm:-mx-4 max-sm:w-[calc(100%+2rem)] max-sm:overflow-x-auto max-sm:px-4 sm:flex-wrap"
          role="group"
          aria-label="Filter by status"
        >
          {FILTERS.map((item) => (
            <Chip
              key={item.value}
              icon={item.icon}
              count={counts[item.value]}
              selected={filter === item.value}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </Chip>
          ))}
        </div>
      </div>

      <section aria-label="People" className="overflow-hidden rounded-xl border border-subtle bg-surface-1 shadow-xs">
        <div className="hidden grid-cols-[minmax(0,1fr)_9.5rem_8rem_8rem_2.5rem] gap-4 border-b border-subtle bg-layer-1 px-4 py-2 text-12 font-medium text-tertiary md:grid">
          <span>Person</span>
          <span>Role</span>
          <span>Status</span>
          <span>Last sign-in</span>
          <span className="sr-only">Actions</span>
        </div>
        {visible.length === 0 ? (
          <div className="grid place-items-center bg-dot-grid px-6 py-12 text-center">
            <UserCircleIcon className="size-6 text-tertiary" />
            <p className="mt-2 text-13 text-secondary">
              {needle ? `No one matches “${query.trim()}”.` : "No one in this list yet."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-subtle">
            {visible.map((row) =>
              row.kind === "member" ? (
                <MemberRow
                  key={row.member.id}
                  member={row.member}
                  status={row.status}
                  onRole={(role) =>
                    void run(
                      () => summonService.updateUser(workspaceSlug, row.member.id, { role }),
                      `${row.member.name} is now ${roleLabel(role)}`
                    )
                  }
                  onDeactivate={() =>
                    setConfirm({
                      title: `Deactivate ${row.member.name}?`,
                      content:
                        "They lose access to this workspace and every project in it right away. Restoring them later gives back workspace access only; project admins re-add them to projects.",
                      action: `${row.member.name} deactivated`,
                      run: () => summonService.updateUser(workspaceSlug, row.member.id, { is_active: false }),
                    })
                  }
                  onRestore={() =>
                    void run(
                      () => summonService.updateUser(workspaceSlug, row.member.id, { is_active: true }),
                      `${row.member.name} restored`
                    )
                  }
                />
              ) : (
                <InviteRow
                  key={row.invite.id}
                  invite={row.invite}
                  onRevoke={() =>
                    setConfirm({
                      title: `Revoke the invite for ${row.invite.email}?`,
                      content: "Signing in with this Google account will no longer let them into the workspace.",
                      action: "Invite revoked",
                      run: () => summonService.revokeInvite(workspaceSlug, row.invite.id),
                    })
                  }
                />
              )
            )}
          </ul>
        )}
      </section>

      <AccessHistory events={history.data} isLoading={history.isLoading} />

      <AlertModalCore
        isOpen={Boolean(confirm)}
        title={confirm?.title ?? ""}
        content={confirm?.content ?? ""}
        variant="danger"
        isSubmitting={busy}
        primaryButtonText={{
          default: confirm?.title.startsWith("Revoke") ? "Revoke invite" : "Deactivate",
          loading: "Saving",
        }}
        handleClose={() => setConfirm(null)}
        handleSubmit={() => void confirmAndRun()}
      />
    </div>
  );
}

function MemberRow(props: {
  member: ISummonWorkspaceUser;
  status: TStatus;
  onRole: (role: TSummonRole) => void;
  onDeactivate: () => void;
  onRestore: () => void;
}) {
  const { member, status, onRole, onDeactivate, onRestore } = props;
  // The API refuses these too; the row shows why instead of offering a control that fails.
  const locked = member.is_you ? "You can't change your own access" : member.is_owner ? "Workspace owner" : null;
  const { name } = member;

  return (
    <li className={rowClassName}>
      <Person
        avatar={<Avatar size={32} name={name} src={getFileURL(member.avatar_url ?? "")} />}
        name={name}
        email={member.email}
        tags={
          <>
            {member.is_you ? <Badge size="sm">You</Badge> : null}
            {member.is_owner ? <Badge size="sm">Owner</Badge> : null}
          </>
        }
      />
      <div className="flex items-center gap-2">
        {locked || status === "deactivated" ? (
          <span className="flex items-center gap-1.5 text-13 text-secondary" title={locked ?? undefined}>
            {locked ? <LockSimpleIcon className="size-3.5 text-tertiary" aria-label={locked} /> : null}
            {roleLabel(member.role)}
          </span>
        ) : (
          <Select
            aria-label={`Role for ${name}`}
            value={String(member.role)}
            onValueChange={(value) => onRole(Number(value) as TSummonRole)}
            options={ROLE_OPTIONS.map((option) => ({ value: String(option.value), label: option.label }))}
            className="h-8 md:w-full"
          />
        )}
      </div>
      <StatusBadge status={status} />
      <span className="text-13 text-tertiary tabular-nums max-md:hidden">
        {member.last_signed_in ? calculateTimeAgo(member.last_signed_in) : "Never signed in"}
      </span>
      <div className="flex justify-end max-md:absolute max-md:top-3 max-md:right-3">
        {locked ? null : status === "deactivated" ? (
          <RowMenu label={`Actions for ${name}`}>
            <Menu.MenuItem onClick={onRestore}>
              <ArrowCounterClockwiseIcon className="size-4 text-secondary" />
              Restore access
            </Menu.MenuItem>
          </RowMenu>
        ) : (
          <RowMenu label={`Actions for ${name}`}>
            <Menu.MenuItem onClick={onDeactivate} className="text-danger-primary">
              <UserMinusIcon className="size-4" />
              Deactivate
            </Menu.MenuItem>
          </RowMenu>
        )}
      </div>
    </li>
  );
}

function InviteRow(props: { invite: ISummonWorkspaceInvite; onRevoke: () => void }) {
  const { invite, onRevoke } = props;
  return (
    <li className={rowClassName}>
      <Person
        avatar={
          <span className="grid size-8 flex-none place-items-center rounded-full border border-dashed border-strong text-tertiary">
            <EnvelopeSimpleIcon className="size-4" />
          </span>
        }
        name={invite.email}
        email={`Invited ${calculateTimeAgo(invite.invited_at)}`}
      />
      <span className="text-13 text-secondary">{roleLabel(invite.role)}</span>
      <StatusBadge status="invited" />
      <span className="text-13 text-tertiary max-md:hidden">Not signed in yet</span>
      <div className="flex justify-end max-md:absolute max-md:top-3 max-md:right-3">
        <RowMenu label={`Actions for ${invite.email}`}>
          <Menu.MenuItem onClick={onRevoke} className="text-danger-primary">
            <XIcon className="size-4" />
            Revoke invite
          </Menu.MenuItem>
        </RowMenu>
      </div>
    </li>
  );
}

const rowClassName =
  "relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_9.5rem_8rem_8rem_2.5rem] max-md:pr-14 max-md:[&>*:first-child]:col-span-2";

function Person(props: { avatar: React.ReactNode; name: string; email: string; tags?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {props.avatar}
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-13 font-medium text-primary">{props.name}</span>
          {props.tags}
        </div>
        <p className="truncate text-12 text-tertiary">{props.email}</p>
      </div>
    </div>
  );
}

function StatusBadge(props: { status: TStatus }) {
  const { label, icon: StatusIcon, variant } = STATUS[props.status];
  return (
    <span>
      <Badge variant={variant} icon={StatusIcon}>
        {label}
      </Badge>
    </span>
  );
}

function RowMenu(props: { label: string; children: React.ReactNode }) {
  return (
    <Menu ariaLabel={props.label} placement="bottom-end" ellipsis>
      {props.children}
    </Menu>
  );
}
