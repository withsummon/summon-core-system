/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { CircleUserRound } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Input } from "@plane/ui";
import { DeactivateAccountModal } from "@/components/account/deactivate-account-modal";
import { ProfileAvatarDialog } from "@/components/account/native-entry/avatar";
import { ImagePickerPopoverView } from "@/components/core/image-picker-popover";
import { ChangeEmailModal } from "@/components/core/modals/change-email-modal";
import { CoverImage } from "@/components/common/cover-image";
import { SettingsBoxedControlItem } from "@/components/settings/boxed-control-item";
import { AuthenticatedAssetImage } from "@/components/convex-core/assets/image";
import { uploadFileAsset } from "@/components/convex-core/assets/upload-file";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { isStaticCoverImage } from "@/helpers/cover-image.helper";

export function GeneralProfileSettingsForm({
  profile,
}: {
  profile: FunctionReturnType<typeof api.identity.profile.get>;
}) {
  const [isImageUploadModalOpen, setIsImageUploadModalOpen] = useState(false);
  const [deactivateAccountModal, setDeactivateAccountModal] = useState(false);
  const [isChangeEmailModalOpen, setIsChangeEmailModalOpen] = useState(false);
  const [coverPending, setCoverPending] = useState(false);
  const transfer = useRef<AbortController | null>(null);
  useEffect(() => () => transfer.current?.abort(), []);
  const { t } = useTranslation();
  const appearance = useQuery(api.identity.avatar.get);
  const availability = useQuery(api.identity.mail.availability.get);
  const policy = useQuery(api.assets.index.policy);
  const save = useMutation(api.identity.profile.save);
  const prepare = useMutation(api.identity.avatar.prepare);
  const finalize = useAction(api.identity.avatar_upload.finalize);
  const setCoverExternal = useMutation(api.identity.avatar.setCoverExternal);
  const values = {
    firstName: profile.firstName,
    lastName: profile.lastName,
    displayName: profile.displayName,
    timezone: profile.timezone,
    expectedRevision: profile.revision,
  } satisfies FunctionArgs<typeof api.identity.profile.save>;
  const {
    handleSubmit,
    watch,
    register,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FunctionArgs<typeof api.identity.profile.save>>({ defaultValues: values });
  const pending = isSubmitting || coverPending || isImageUploadModalOpen;
  const acknowledge = (starting: number, committed: number) => {
    if (getValues("expectedRevision") === starting) setValue("expectedRevision", committed);
  };
  const onSubmit = async (fields: FunctionArgs<typeof api.identity.profile.save>) => {
    try {
      const receipt = await save(fields);
      acknowledge(fields.expectedRevision, receipt.revision);
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Success!", message: "Profile updated successfully." });
    } catch (failure) {
      setToast({ type: TOAST_TYPE.ERROR, title: t("toast.error"), message: mutationMessage(failure) });
    }
  };
  if (!appearance || !policy) return <p role="status">Loading profile images…</p>;

  const changeCover = async (selection: File | string) => {
    setCoverPending(true);
    const starting = getValues("expectedRevision");
    const controller = new AbortController();
    transfer.current = controller;
    try {
      if (typeof selection === "string") {
        if (!isStaticCoverImage(selection)) {
          const receipt = await setCoverExternal({ expectedRevision: starting, url: selection || null });
          acknowledge(starting, receipt.revision);
          return;
        }
        const response = await fetch(selection, { signal: controller.signal });
        if (!response.ok) throw new Error("Could not load the selected cover.");
        const image = await response.blob();
        selection = new File([image], "profile-cover.jpg", { type: image.type });
      }
      const receipt = await uploadFileAsset(
        selection,
        policy,
        (metadata) => prepare({ ...metadata, slot: "cover", expectedRevision: starting }),
        finalize,
        controller.signal
      );
      acknowledge(receipt.startingRevision, receipt.profileRevision);
    } finally {
      transfer.current = null;
      setCoverPending(false);
    }
  };
  return (
    <>
      <DeactivateAccountModal isOpen={deactivateAccountModal} onClose={() => setDeactivateAccountModal(false)} />
      <ChangeEmailModal isOpen={isChangeEmailModalOpen} onClose={() => setIsChangeEmailModalOpen(false)} />
      {isImageUploadModalOpen && (
        <ProfileAvatarDialog
          revision={getValues("expectedRevision")}
          onClose={() => setIsImageUploadModalOpen(false)}
          onAcknowledged={acknowledge}
        />
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="w-full">
        <fieldset className="flex w-full min-w-0 flex-col gap-7" disabled={pending}>
          <div className="relative h-44 w-full">
            {appearance.cover ? (
              <AuthenticatedAssetImage
                key={appearance.cover.id}
                asset={appearance.cover}
                className="h-44 w-full rounded-lg object-cover"
                alt="Profile cover"
              />
            ) : (
              <CoverImage
                src={appearance.externalCoverUrl}
                className="h-44 w-full rounded-lg"
                alt="Profile cover"
                showDefaultWhenEmpty
              />
            )}
            <div className="absolute -bottom-6 left-6 flex items-end justify-between">
              <div className="flex gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-surface-2">
                  <button
                    type="button"
                    aria-label="Change profile image"
                    onClick={() => setIsImageUploadModalOpen(true)}
                  >
                    {appearance.avatar ? (
                      <div className="relative h-16 w-16 overflow-hidden">
                        <AuthenticatedAssetImage
                          key={appearance.avatar.id}
                          asset={appearance.avatar}
                          className="absolute top-0 left-0 h-full w-full rounded-lg object-cover"
                          alt="Profile avatar"
                        />
                      </div>
                    ) : (
                      <div className="h-16 w-16 rounded-md bg-layer-1 p-2">
                        <CircleUserRound className="h-full w-full text-secondary" />
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>
            <div className="absolute right-3 bottom-3 flex">
              <ImagePickerPopoverView
                label={t("change_cover")}
                value={appearance.externalCoverUrl}
                disabled={pending}
                currentImage={
                  appearance.cover && (
                    <AuthenticatedAssetImage
                      asset={appearance.cover}
                      alt="Current profile cover"
                      className="h-full w-full object-cover"
                    />
                  )
                }
                onUpload={changeCover}
                onSelect={changeCover}
              />
            </div>
          </div>
          <div className="item-center mt-6 flex justify-between">
            <div className="flex flex-col">
              <div className="item-center flex text-16 font-medium text-secondary">
                <span>{`${watch("firstName")} ${watch("lastName")}`}</span>
              </div>
              <span className="text-13 tracking-tight text-tertiary">{profile.email}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="profile-firstName" className="text-13 font-medium text-secondary">
                  {t("first_name")}
                </label>
                <Input
                  {...register("firstName")}
                  id="profile-firstName"
                  type="text"
                  placeholder="Enter your first name"
                  className="w-full rounded-md"
                  maxLength={255}
                  autoComplete="given-name"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="profile-lastName" className="text-13 font-medium text-secondary">
                  {t("last_name")}
                </label>
                <Input
                  {...register("lastName")}
                  id="profile-lastName"
                  type="text"
                  placeholder="Enter your last name"
                  className="w-full rounded-md"
                  maxLength={255}
                  autoComplete="family-name"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="profile-displayName" className="text-13 font-medium text-secondary">
                  {t("display_name")}&nbsp;
                  <span className="text-danger-primary">*</span>
                </label>
                <Input
                  {...register("displayName", { required: "Display name is required." })}
                  id="profile-displayName"
                  type="text"
                  hasError={Boolean(errors.displayName)}
                  placeholder="Enter your display name"
                  className="w-full"
                  maxLength={255}
                />
                {errors.displayName && (
                  <span className="text-11 text-danger-primary">{errors.displayName.message}</span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="profile-email" className="text-13 font-medium text-secondary">
                  {t("auth.common.email.label")}&nbsp;
                  <span className="text-danger-primary">*</span>
                </label>
                <Input
                  id="profile-email"
                  name="email"
                  type="email"
                  value={profile.email ?? ""}
                  disabled
                  className="w-full cursor-not-allowed rounded-md !bg-surface-2"
                  autoComplete="email"
                />
                {availability?.emailVerification && (
                  <button
                    type="button"
                    className="btn w-fit text-11 text-secondary underline"
                    onClick={() => setIsChangeEmailModalOpen(true)}
                  >
                    {t("account_settings.profile.change_email_modal.title")}
                  </button>
                )}
              </div>
            </div>
          </div>
          {profile.revision > watch("expectedRevision") && (
            <div role="status" className="flex flex-wrap items-center gap-3 text-13 text-secondary">
              <span>Your profile changed elsewhere. Reload the saved profile before saving.</span>
              <Button variant="secondary" type="button" onClick={() => reset(values)}>
                Reload profile and discard edits
              </Button>
            </div>
          )}
          <div>
            <Button variant="primary" type="submit" loading={isSubmitting}>
              {isSubmitting ? t("saving") : t("save_changes")}
            </Button>
          </div>
        </fieldset>
      </form>
      <div className="mt-10">
        <SettingsBoxedControlItem
          title={t("deactivate_account")}
          description="Deactivation removes your sign-in credentials and workspace access. Your work remains in the workspace. This account cannot be reactivated."
          control={
            <Button variant="error-outline" disabled={pending} onClick={() => setDeactivateAccountModal(true)}>
              {t("deactivate_account")}
            </Button>
          }
        />
      </div>
    </>
  );
}
