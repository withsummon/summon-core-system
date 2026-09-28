/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { Dialog } from "@plane/propel/dialog";
import { CloseIcon, PlusIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { CustomSelect, Input } from "@plane/ui";
import { mutationMessage } from "@/components/convex-core/commercial/forms";

type InvitationInput = FunctionArgs<typeof api.invitations.index.create>;
type Props = {
  scope: Pick<InvitationInput, "workspaceId" | "projectId">;
  onClose: () => void;
};

export function SendWorkspaceInvitationModal({ scope, onClose }: Props) {
  const { t } = useTranslation();
  const access = useQuery(api.invitations.index.access, scope);
  const availability = useQuery(api.invitations.index.availability, {});
  const create = useMutation(api.invitations.index.create);
  const send = useAction(api.invitations.email.send);
  const [error, setError] = useState("");
  const {
    control,
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<InvitationInput>({
    defaultValues: { ...scope, emails: [{ email: "", role: "member" }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "emails" });
  const close = () => {
    if (!isSubmitting) onClose();
  };
  const submit = async (
    data: InvitationInput,
    emailDelivery: FunctionReturnType<typeof api.invitations.index.availability>["emailDelivery"]
  ) => {
    setError("");
    try {
      if (emailDelivery) {
        const result = await send(data);
        const sent = result.every((receipt) => receipt.delivery === "sent");
        setToast({
          type: sent ? TOAST_TYPE.SUCCESS : TOAST_TYPE.ERROR,
          title: "Invitations created",
          message: sent
            ? t("workspace_settings.settings.members.invitations_sent_successfully")
            : "Some email deliveries could not be confirmed. Review pending invitations to copy links or resend.",
        });
      } else {
        await create(data);
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "Invitations created",
          message: "Copy each invitation link from Pending invites and share it with the recipient.",
        });
      }
      onClose();
    } catch (failure) {
      setError(`${mutationMessage(failure)} Review pending invitations before retrying.`);
    }
  };
  const ready = access !== undefined && availability !== undefined;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Dialog.Panel position="top">
        <form
          onSubmit={ready ? handleSubmit((data) => submit(data, availability.emailDelivery)) : undefined}
          className="p-5"
        >
          <div className="space-y-4">
            <Dialog.Title className="text-body-md-medium leading-6 text-primary">
              {t("workspace_settings.settings.members.modal.title")}
            </Dialog.Title>
            <p className="text-body-xs-regular text-secondary">
              {availability &&
                (availability.emailDelivery
                  ? t("workspace_settings.settings.members.modal.description")
                  : "Create invitations, then copy and share each link. Email delivery is unavailable.")}
            </p>
            {!ready ? (
              <p role="status">Loading invitation permissions…</p>
            ) : access.roles.length === 0 ? (
              <p role="alert">Your current role cannot invite members here.</p>
            ) : (
              <div className="mb-3 space-y-4">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="group relative mb-1 flex w-full items-start justify-between gap-x-4 text-body-xs-regular"
                  >
                    <div className="w-full">
                      <Input
                        {...register(`emails.${index}.email`, {
                          required: t("workspace_settings.settings.members.modal.errors.required"),
                        })}
                        id={`emails.${index}.email`}
                        aria-label={`Email address ${index + 1}`}
                        type="email"
                        required
                        disabled={isSubmitting}
                        hasError={Boolean(errors.emails?.[index]?.email)}
                        placeholder={t("workspace_settings.settings.members.modal.placeholder")}
                        className="w-full text-caption-sm-regular sm:text-body-xs-regular"
                      />
                      {errors.emails?.[index]?.email && (
                        <span className="ml-1 text-caption-sm-regular text-danger-primary">
                          {errors.emails[index]?.email?.message}
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-2">
                      <Controller
                        control={control}
                        name={`emails.${index}.role`}
                        render={({ field: { value, onChange } }) => (
                          <CustomSelect<InvitationInput["emails"][number]["role"]>
                            value={value}
                            disabled={isSubmitting}
                            ariaLabel={`Access role for invitation ${index + 1}`}
                            label={
                              <span className="text-caption-sm-regular sm:text-body-xs-regular">
                                {t(`role_details.${value}.title`)}
                              </span>
                            }
                            onChange={onChange}
                            className="w-24 flex-grow"
                            input
                          >
                            {access.roles.map((role) => (
                              <CustomSelect.Option key={role} value={role}>
                                {t(`role_details.${role}.title`)}
                              </CustomSelect.Option>
                            ))}
                          </CustomSelect>
                        )}
                      />
                      {fields.length > 1 && (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          aria-label={`Remove invitation ${index + 1}`}
                          className="grid w-6 place-items-center self-center rounded-sm"
                          onClick={() => remove(index)}
                        >
                          <CloseIcon className="size-4 text-secondary" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {error && (
              <p role="alert" className="text-body-xs-regular text-danger-primary">
                {error}
              </p>
            )}
          </div>
          <div className="mt-5 flex items-center justify-between gap-2">
            <button
              type="button"
              className="flex items-center gap-1 bg-transparent py-2 pr-3 text-caption-md-medium text-accent-primary outline-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
              disabled={
                isSubmitting ||
                !ready ||
                access.roles.length === 0 ||
                fields.length >= availability.maxCreateInvitations
              }
              onClick={() => append({ email: "", role: "member" })}
            >
              <PlusIcon className="size-3.5" aria-hidden="true" />
              {t("common.add_more")}
            </button>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="lg" disabled={isSubmitting} onClick={close}>
                {t("cancel")}
              </Button>
              <Button
                variant="primary"
                size="lg"
                type="submit"
                loading={isSubmitting}
                disabled={!ready || access.roles.length === 0}
              >
                {availability?.emailDelivery
                  ? t(
                      isSubmitting
                        ? "workspace_settings.settings.members.modal.button_loading"
                        : "workspace_settings.settings.members.modal.button"
                    )
                  : isSubmitting
                    ? "Creating invitations"
                    : "Create invitations"}
              </Button>
            </div>
          </div>
        </form>
      </Dialog.Panel>
    </Dialog>
  );
}
