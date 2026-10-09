/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { ComboboxPrimitive as Combobox } from "@plane/propel/combobox";
import { Dialog } from "@plane/propel/dialog";
import { PlusIcon, CloseIcon, ChevronDownIcon, SearchIcon, CheckIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { CustomSelect, EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
import { AuthenticatedAssetImage } from "@/components/convex-core/assets/image";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";

type Candidate = FunctionReturnType<typeof api.projects.index.availableMembers>["page"][number];
type AddArgs = FunctionArgs<typeof api.projects.index.addMembers>;

export function SendProjectInvitationModal({
  onClose,
  projectId,
  canManage,
}: {
  onClose: () => void;
  projectId: AddArgs["projectId"];
  canManage: boolean;
}) {
  const { t } = useTranslation();
  const addMembers = useMutation(api.projects.index.addMembers);
  const cancel = useRef<HTMLButtonElement>(null);
  const [members, setMembers] = useState<
    Array<{ key: string; candidate: Candidate | null; role: AddArgs["members"][number]["role"] | null }>
  >(() => [{ key: crypto.randomUUID(), candidate: null, role: null }]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const release = useReloadConfirmations(
    members.some((member) => member.candidate !== null) || pending,
    "This project member selection has unsaved changes.",
    undefined,
    pending
  );
  const close = () => {
    if (!pending) {
      release();
      onClose();
    }
  };
  const submit = async () => {
    if (pending || !canManage) return;
    setPending(true);
    setError("");
    try {
      const payload = members.map(({ candidate, role }) => {
        if (!candidate || !role) throw new Error("Select a co-worker and role for every row.");
        return { userId: candidate.userId, role, expectedRevision: candidate.expectedRevision };
      });
      await addMembers({ projectId, members: payload });
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Success!", message: "Members added successfully." });
      release();
      onClose();
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  };
  return (
    <ModalCore
      isOpen
      handleClose={close}
      position={EModalPosition.CENTER}
      width={EModalWidth.XXL}
      initialFocus={cancel}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="p-5"
      >
        <div className="space-y-5">
          <Dialog.Title className="text-16 leading-6 font-medium text-primary">
            {t("project_settings.members.invite_members.title")}
          </Dialog.Title>
          <Dialog.Description className="text-13 text-secondary">
            {t("project_settings.members.invite_members.sub_heading")}
          </Dialog.Description>
          <div className="mb-3 space-y-4">
            {members.map((entry, index) => (
              <div
                key={entry.key}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-2 text-13 sm:grid-cols-[minmax(0,1fr)_7rem_auto] sm:gap-4"
              >
                <ProjectMemberPicker
                  projectId={projectId}
                  selected={entry.candidate}
                  disabled={pending || !canManage}
                  selectedIds={members.flatMap((member) => (member.candidate ? [member.candidate.userId] : []))}
                  onSelect={(candidate) =>
                    setMembers((current) =>
                      current.map((member, i) =>
                        i === index ? { ...member, candidate, role: candidate.workspaceRole } : member
                      )
                    )
                  }
                />
                <CustomSelect<AddArgs["members"][number]["role"]>
                  value={entry.role ?? undefined}
                  disabled={pending || !canManage || !entry.candidate}
                  ariaLabel={`Role for ${entry.candidate?.displayName ?? `co-worker ${index + 1}`}`}
                  label={<span>{entry.role ? t(`role_details.${entry.role}.title`) : "Select role"}</span>}
                  className="w-28 shrink-0"
                  input
                  onChange={(role) =>
                    setMembers((current) => current.map((member, i) => (i === index ? { ...member, role } : member)))
                  }
                >
                  {entry.candidate?.allowedRoles.map((role) => (
                    <CustomSelect.Option key={role} value={role}>
                      {t(`role_details.${role}.title`)}
                    </CustomSelect.Option>
                  ))}
                </CustomSelect>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove co-worker ${index + 1}`}
                  disabled={pending}
                  onClick={() =>
                    setMembers((current) =>
                      current.length === 1
                        ? [{ key: crypto.randomUUID(), candidate: null, role: null }]
                        : current.filter((_, i) => i !== index)
                    )
                  }
                >
                  <CloseIcon className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
          {!canManage && (
            <p role="alert" className="text-13 text-danger-primary">
              Your project permissions changed. Your selection is retained; an administrator must restore access before
              you can add members.
            </p>
          )}
          {error && (
            <p role="alert" className="text-13 text-danger-primary">
              {error}
            </p>
          )}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="ghost"
            disabled={pending || !canManage || members.length >= 20}
            onClick={() =>
              setMembers((current) => [...current, { key: crypto.randomUUID(), candidate: null, role: null }])
            }
          >
            <PlusIcon className="size-4" aria-hidden="true" />
            {t("common.add_more")}
          </Button>
          <div className="flex items-center gap-2">
            <Button ref={cancel} variant="secondary" size="lg" disabled={pending} onClick={close}>
              {t("cancel")}
            </Button>
            <Button
              variant="primary"
              size="lg"
              type="submit"
              loading={pending}
              disabled={!canManage || members.some((member) => !member.candidate || !member.role)}
            >
              {t(members.length > 1 ? "add_members" : "add_member")}
            </Button>
          </div>
        </div>
      </form>
    </ModalCore>
  );
}

function ProjectMemberPicker({
  projectId,
  selected,
  selectedIds,
  onSelect,
  disabled,
}: {
  projectId: AddArgs["projectId"];
  selected: Candidate | null;
  selectedIds: Candidate["userId"][];
  onSelect: (candidate: Candidate) => void;
  disabled: boolean;
}) {
  const [search, setSearch] = useState("");
  const choices = usePaginatedQuery(
    api.projects.index.availableMembers,
    { projectId, search },
    { initialNumItems: 30 }
  );
  return (
    <Combobox.Root
      value={selected?.userId ?? null}
      disabled={disabled}
      filter={null}
      inputValue={search}
      onInputValueChange={setSearch}
      onOpenChange={(open) => {
        if (!open) setSearch("");
      }}
      onValueChange={(userId) => {
        const choice = choices.results.find((candidate) => candidate.userId === userId);
        if (choice) onSelect(choice);
      }}
    >
      <Combobox.Trigger
        aria-label="Select co-worker"
        className="col-span-2 flex min-w-0 items-center justify-between gap-2 rounded-md border border-subtle px-3 py-2 text-left text-13 text-secondary disabled:opacity-50 sm:col-span-1"
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.avatar && (
            <AuthenticatedAssetImage
              asset={selected.avatar}
              alt="Member avatar"
              compactName={selected.displayName ?? selected.fullName}
              className="size-5 rounded-full"
            />
          )}
          <span className="truncate">
            {selected ? (selected.displayName ?? selected.fullName) : "Select co-worker"}
          </span>
        </span>
        <ChevronDownIcon className="size-3 shrink-0" aria-hidden="true" />
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner side="bottom" align="start" sideOffset={4} className="z-[120]">
          <Combobox.Popup className="w-80 max-w-[calc(100vw-2rem)] rounded-md border border-subtle bg-surface-1 p-2 shadow-raised-200">
            <div className="flex items-center gap-2 rounded border border-subtle px-2">
              <SearchIcon className="size-3.5 text-placeholder" aria-hidden="true" />
              <Combobox.Input
                aria-label="Search available co-workers"
                placeholder="Search"
                className="w-full bg-transparent py-2 text-13 outline-none"
              />
            </div>
            <Combobox.List className="mt-2 max-h-48 overflow-y-auto">
              {choices.results.map((candidate) => (
                <Combobox.Item
                  key={candidate.userId}
                  value={candidate.userId}
                  disabled={selectedIds.includes(candidate.userId) && selected?.userId !== candidate.userId}
                  className="flex min-w-0 items-center gap-2 rounded px-2 py-2 text-13 data-[disabled]:opacity-50 data-[highlighted]:bg-layer-transparent-hover"
                >
                  {candidate.avatar && (
                    <AuthenticatedAssetImage
                      asset={candidate.avatar}
                      alt="Member avatar"
                      compactName={candidate.displayName ?? candidate.fullName}
                      className="size-5 rounded-full"
                    />
                  )}
                  <span className="min-w-0 grow truncate">
                    {candidate.displayName ?? candidate.fullName}
                    <span className="ml-1 text-tertiary">({candidate.fullName})</span>
                  </span>
                  <Combobox.ItemIndicator>
                    <CheckIcon className="size-3.5" />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              ))}
            </Combobox.List>
            {choices.status === "LoadingFirstPage" && (
              <p role="status" className="p-2 text-13 text-tertiary">
                Loading co-workers…
              </p>
            )}
            {choices.status === "Exhausted" && choices.results.length === 0 && (
              <p className="p-2 text-13 text-tertiary">No matching co-workers</p>
            )}
            {choices.status === "CanLoadMore" && (
              <Button variant="secondary" size="sm" onClick={() => choices.loadMore(30)}>
                Load more co-workers
              </Button>
            )}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
