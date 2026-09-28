/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import { LinkIcon, TrashIcon, ChevronDownIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { CustomSelect, CustomMenu } from "@plane/ui";
import { copyTextToClipboard } from "@plane/utils";
import { ConfirmWorkspaceMemberRemove } from "@/components/workspace/confirm-workspace-member-remove";
import { mutationMessage } from "@/components/convex-core/commercial/forms";

type Invitation = FunctionReturnType<typeof api.invitations.index.pending>[number];
type Props = {
  invitation: Invitation;
  roles: FunctionReturnType<typeof api.invitations.index.access>["roles"];
  emailDelivery: FunctionReturnType<typeof api.invitations.index.availability>["emailDelivery"];
};

export function WorkspaceInvitationsListItem({ invitation, roles, emailDelivery }: Props) {
  const { t } = useTranslation();
  const updateRole = useMutation(api.invitations.index.updateRole);
  const revoke = useMutation(api.invitations.index.revoke);
  const resend = useAction(api.invitations.email.resend);
  const [selection, setSelection] = useState<Invitation | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const canManage = roles.includes(invitation.role);
  const copy = async () => {
    const url = new URL("/workspace-invitations/", window.location.origin);
    url.searchParams.set("invitation_id", invitation._id);
    try {
      await copyTextToClipboard(url.href);
      setError("");
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("common.link_copied"),
        message: t("entity.link_copied_to_clipboard", { entity: t("common.invite") }),
      });
    } catch {
      setError("The link could not be copied. Allow clipboard access and try again.");
    }
  };
  const send = async () => {
    setPending(true);
    setError("");
    try {
      const result = await resend({ invitationId: invitation._id, expectedRevision: invitation.revision });
      if (result.delivery === "sent")
        setToast({ type: TOAST_TYPE.SUCCESS, title: "Invitation email sent", message: invitation.email });
      else
        setError(
          result.delivery === "failed"
            ? "Email delivery failed. Copy the invitation link or resend it."
            : "This invitation changed during delivery. Check its current status before resending."
        );
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  };
  return (
    <>
      {selection && (
        <ConfirmWorkspaceMemberRemove
          kind="invitation"
          displayName={selection.email}
          onClose={() => setSelection(null)}
          onSubmit={async () => {
            await revoke({ invitationId: selection._id, expectedRevision: selection.revision });
          }}
        />
      )}
      <div className="group flex h-full w-full items-center justify-between gap-3 px-3 py-4 hover:bg-layer-transparent-hover">
        <div className="flex min-w-0 items-center gap-x-4 gap-y-2">
          <span
            className="relative flex size-10 shrink-0 items-center justify-center rounded-sm bg-layer-3 p-4 text-tertiary capitalize"
            aria-hidden="true"
          >
            {invitation.email[0]}
          </span>
          <div className="min-w-0">
            <h4 className="cursor-default text-body-xs-regular break-all">{invitation.email}</h4>
            {invitation.delivery === "failed" && (
              <p role="status" className="text-caption-sm-regular text-danger-primary">
                Email delivery failed. Copy the link or resend.
              </p>
            )}
            {error && (
              <p role="alert" className="text-caption-sm-regular text-danger-primary">
                {error}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-11">
          <span className="rounded-sm bg-label-yellow-bg-strong/20 px-2.5 py-1 text-caption-sm-medium text-label-yellow-text">
            {t("common.pending")}
          </span>
          <CustomSelect<Invitation["role"]>
            value={invitation.role}
            disabled={!canManage || pending}
            ariaLabel={`Invitation role for ${invitation.email}`}
            customButton={
              <span className="flex items-center gap-1 rounded-sm px-2 py-0.5 text-caption-sm-medium">
                {t(`role_details.${invitation.role}.title`)}
                <ChevronDownIcon className="size-3" aria-hidden="true" />
              </span>
            }
            onChange={async (role) => {
              setPending(true);
              setError("");
              try {
                await updateRole({ invitationId: invitation._id, expectedRevision: invitation.revision, role });
              } catch (failure) {
                setError(mutationMessage(failure));
              } finally {
                setPending(false);
              }
            }}
            placement="bottom-end"
          >
            {roles.map((role) => (
              <CustomSelect.Option key={role} value={role}>
                {t(`role_details.${role}.title`)}
              </CustomSelect.Option>
            ))}
          </CustomSelect>
          <CustomMenu
            ellipsis
            ariaLabel={`Invitation actions for ${invitation.email}`}
            placement="bottom-end"
            closeOnSelect
            disabled={pending}
          >
            <CustomMenu.MenuItem onClick={() => void copy()}>
              <LinkIcon className="size-3.5" aria-hidden="true" />
              {t("common.actions.copy_link")}
            </CustomMenu.MenuItem>
            {canManage && emailDelivery && (
              <CustomMenu.MenuItem onClick={() => void send()}>Resend email</CustomMenu.MenuItem>
            )}
            {canManage && (
              <CustomMenu.MenuItem onClick={() => setSelection(invitation)} className="text-danger-primary">
                <TrashIcon className="size-3.5" aria-hidden="true" />
                {t("common.remove")}
              </CustomMenu.MenuItem>
            )}
          </CustomMenu>
        </div>
      </div>
    </>
  );
}
