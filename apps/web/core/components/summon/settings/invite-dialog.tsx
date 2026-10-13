/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { sortBy } from "lodash-es";
import { observer } from "mobx-react";
import { CopyIcon, UserPlusIcon, XIcon } from "@phosphor-icons/react";
import { Button } from "@plane/propel/button";
import { Dialog, EDialogWidth } from "@plane/propel/dialog";
import { Input } from "@plane/propel/input";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TSummonRole } from "@plane/types";
import { cn } from "@plane/utils";
import { useProject } from "@/hooks/store/use-project";
import { summonService } from "@/services/summon.service";
import { ROLE_OPTIONS, accessErrorMessage } from "./roles";

/**
 * Adds a person by email and role, optionally straight onto projects. They get in by signing
 * in with Google using that email; projects for a new email apply on that first sign-in.
 */
export const InviteDialog = observer(function InviteDialog(props: {
  workspaceSlug: string;
  open: boolean;
  onClose: () => void;
  onInvited: () => void;
}) {
  const { workspaceSlug, open, onClose, onInvited } = props;
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TSummonRole>(15);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const close = () => {
    setEmail("");
    setRole(15);
    setProjectIds([]);
    setError("");
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await summonService.inviteUser(workspaceSlug, { email, role, project_ids: projectIds });
      setToast({ type: TOAST_TYPE.SUCCESS, title: `${email.trim()} can now sign in` });
      onInvited();
      close();
    } catch (requestError) {
      setError(accessErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const copySignInLink = async () => {
    await navigator.clipboard.writeText(window.location.origin);
    setToast({ type: TOAST_TYPE.INFO, title: "Sign-in link copied" });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <Dialog.Panel
        width={EDialogWidth.MD}
        initialFocus={emailRef}
        className="w-[calc(100vw-2rem)] overflow-hidden rounded-xl"
      >
        <form onSubmit={submit}>
          <header className="flex items-start justify-between gap-3 px-5 pt-5">
            <div>
              <Dialog.Title className="text-16 font-semibold text-primary">Invite people</Dialog.Title>
              <p className="mt-1 text-13 text-secondary">They get in by signing in with Google using this email.</p>
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

          <div className="grid gap-4 px-5 py-4">
            <label htmlFor="invite-email" className="grid gap-1.5">
              <span className="text-12 font-medium text-secondary">Work email</span>
              <Input
                id="invite-email"
                type="email"
                required
                ref={emailRef}
                autoComplete="off"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@company.com"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "invite-error" : undefined}
                className="w-full"
              />
            </label>

            <fieldset className="grid gap-1.5">
              <legend className="mb-1.5 text-12 font-medium text-secondary">Role</legend>
              {ROLE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 rounded-lg border px-3 py-2.5 transition-[background-color,border-color] duration-150",
                    role === option.value ? "border-accent-strong bg-accent-subtle" : "border-subtle hover:bg-layer-1"
                  )}
                >
                  <input
                    type="radio"
                    name="role"
                    value={option.value}
                    checked={role === option.value}
                    onChange={() => setRole(option.value)}
                    className="mt-0.5 accent-[var(--color-accent-primary)]"
                  />
                  <span className="text-13 font-medium text-primary">{option.label}</span>
                  <span className="col-start-2 text-12 text-secondary">{option.description}</span>
                </label>
              ))}
            </fieldset>

            <ProjectPicker value={projectIds} onChange={setProjectIds} />

            {error ? (
              <p id="invite-error" role="alert" className="text-13 text-danger-primary">
                {error}
              </p>
            ) : null}
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-subtle bg-layer-1 px-5 py-3">
            <button
              type="button"
              onClick={() => void copySignInLink()}
              className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-13 font-medium text-secondary hover:bg-layer-2 hover:text-primary"
            >
              <CopyIcon className="size-4" />
              Copy sign-in link
            </button>
            <div className="flex gap-2">
              <Button variant="secondary" size="lg" type="button" onClick={close}>
                Cancel
              </Button>
              <Button size="lg" type="submit" loading={saving} prependIcon={<UserPlusIcon />}>
                Invite
              </Button>
            </div>
          </footer>
        </form>
      </Dialog.Panel>
    </Dialog>
  );
});

/** Checkbox list of the workspace's active projects; guests see only the projects picked here. */
const ProjectPicker = observer(function ProjectPicker(props: {
  value: string[];
  onChange: (projectIds: string[]) => void;
}) {
  const { value, onChange } = props;
  const { workspaceProjectIds = [], getProjectById } = useProject();
  const projects = sortBy(
    workspaceProjectIds.flatMap((id) => getProjectById(id) ?? []),
    "name"
  );
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);

  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 flex w-full items-baseline justify-between text-12 font-medium text-secondary">
        Projects
        <span className="font-normal text-tertiary tabular-nums">
          {value.length ? `${value.length} selected` : "Optional"}
        </span>
      </legend>
      {projects.length ? (
        <div className="vertical-scrollbar grid scrollbar-sm max-h-44 overflow-y-auto rounded-lg border border-subtle p-1">
          {projects.map((project) => (
            <label
              key={project.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-13 text-primary hover:bg-layer-1"
            >
              <input
                type="checkbox"
                checked={value.includes(project.id)}
                onChange={() => toggle(project.id)}
                className="accent-[var(--color-accent-primary)]"
              />
              <span className="w-12 flex-none truncate font-mono text-11 text-tertiary">{project.identifier}</span>
              <span className="min-w-0 truncate">{project.name}</span>
            </label>
          ))}
        </div>
      ) : (
        <p className="text-12 text-tertiary">No projects yet.</p>
      )}
    </fieldset>
  );
});
