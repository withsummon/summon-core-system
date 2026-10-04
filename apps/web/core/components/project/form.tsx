/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useAction, useConvex, useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Info } from "lucide-react";
import { NETWORK_CHOICES } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { EmojiPicker, EmojiIconPickerTypes, Logo } from "@plane/propel/emoji-icon-picker";
import { LockIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Tooltip } from "@plane/propel/tooltip";
import { CustomSelect, Input, TextArea } from "@plane/ui";
import { projectIdentifierSanitizer, renderFormattedDate } from "@plane/utils";
import { CoverImage } from "@/components/common/cover-image";
import { ImagePickerPopoverView } from "@/components/core/image-picker-popover";
import { TimezoneSelect } from "@/components/global";
import { AuthenticatedAssetImage } from "@/components/convex-core/assets/image";
import { uploadFileAsset } from "@/components/convex-core/assets/upload-file";
import { AssetTransfers } from "@/components/convex-core/documents/asset-transfers";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { usePlatformOS } from "@/hooks/use-platform-os";
import { GeneralProjectSettingsControlSection } from "./settings/control-section";
import { ProjectNetworkIcon } from "./project-network-icon";

export function ProjectDetailsForm({
  project,
  workspaceSlug,
}: {
  project: FunctionReturnType<typeof api.projects.form.get>;
  workspaceSlug: string;
}) {
  const { t } = useTranslation();
  const { isMobile } = usePlatformOS();
  const client = useConvex();
  const save = useMutation(api.projects.form.save);
  const prepare = useMutation(api.projects.form.prepareCover);
  const finalize = useAction(api.assets.upload.finalize);
  const policy = useQuery(api.assets.index.policy);
  const [transfers] = useState(() => new AssetTransfers());
  useEffect(() => () => transfers.dispose(), [transfers]);
  const [isOpen, setIsOpen] = useState(false);
  const [coverPending, setCoverPending] = useState(false);
  const [coverPreview, setCoverPreview] = useState<FunctionReturnType<typeof api.assets.index.get> | null>(null);
  const [error, setError] = useState("");
  const {
    handleSubmit,
    watch,
    control,
    setValue,
    reset,
    getValues,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<
    FunctionReturnType<typeof api.projects.form.get>["input"] &
      Pick<FunctionArgs<typeof api.projects.form.save>, "expectedRevision" | "expectedTimezone" | "cover">
  >({
    defaultValues: {
      ...project.input,
      expectedRevision: project.revision,
      expectedTimezone: project.input.timezone,
    },
  });
  const pending = isSubmitting || coverPending;
  const release = useReloadConfirmations(isDirty || pending, "This project has unsaved changes.", undefined, pending);
  const selectedCover = watch("cover");
  const cover = selectedCover ? coverPreview : project.appearance.cover;
  const logo = watch("logoProps");
  const currentNetwork = NETWORK_CHOICES.find((entry) => entry.key === watch("network"));
  const disabled = pending || !project.canManage;
  const changeCover = async (selection: File | string) => {
    if (!policy) throw new Error("Cover upload policy is unavailable. Your selection is retained.");
    setCoverPending(true);
    try {
      const file =
        typeof selection === "string"
          ? await transfers.run(async (signal) => {
              const response = await fetch(selection, { signal });
              if (!response.ok) throw new Error("The selected cover could not be loaded. Retry its upload.");
              const blob = await response.blob();
              return new File([blob], "project-cover.jpg", { type: blob.type });
            })
          : selection;
      const assetId = await transfers.run((signal) =>
        uploadFileAsset(
          file,
          policy,
          (metadata) =>
            prepare({
              projectId: project.input.projectId,
              expectedRevision: getValues("expectedRevision"),
              expectedCoverRevision: project.appearance.revision,
              ...metadata,
            }),
          finalize,
          signal
        )
      );
      const image = await client.query(api.assets.index.get, { assetId });
      setCoverPreview(image);
      setValue("cover", { assetId, expectedRevision: project.appearance.revision }, { shouldDirty: true });
    } finally {
      setCoverPending(false);
    }
  };
  return (
    <>
      <form
        onSubmit={handleSubmit(async (fields) => {
          setError("");
          try {
            const receipt = await save(fields);
            const { cover: _cover, ...metadata } = fields;
            reset({ ...metadata, expectedRevision: receipt.revision, expectedTimezone: fields.timezone });
            setCoverPreview(null);
            release();
            setToast({
              type: TOAST_TYPE.SUCCESS,
              title: t("toast.success"),
              message: t("project_settings.general.toast.success"),
            });
          } catch (failure) {
            setError(mutationMessage(failure));
          }
        })}
        aria-busy={pending}
      >
        <div className="relative h-44 w-full">
          {cover ? (
            <AuthenticatedAssetImage
              asset={cover}
              alt="Project cover image"
              className="h-44 w-full rounded-md object-cover"
            />
          ) : (
            <CoverImage
              src={selectedCover ? null : project.appearance.externalCoverUrl}
              alt="Project cover image"
              className="h-44 w-full rounded-md"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-4 z-5 flex w-full items-end justify-between gap-3 px-4">
            <div className="flex flex-grow gap-3 truncate">
              <EmojiPicker
                iconType="material"
                closeOnSelect={false}
                isOpen={isOpen}
                handleToggle={setIsOpen}
                className="flex items-center justify-center"
                buttonClassName="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-lg bg-white/10"
                label={<Logo logo={logo.in_use === null ? undefined : logo} size={28} />}
                disabled={disabled}
                onChange={(choice) => {
                  setValue(
                    "logoProps",
                    choice.type === "emoji"
                      ? { in_use: choice.type, emoji: { value: choice.value } }
                      : { in_use: choice.type, icon: choice.value },
                    { shouldDirty: true }
                  );
                  setIsOpen(false);
                }}
                defaultIconColor={logo.in_use === "icon" ? logo.icon?.color : undefined}
                defaultOpen={logo.in_use === "emoji" ? EmojiIconPickerTypes.EMOJI : EmojiIconPickerTypes.ICON}
              />
              <div className="flex flex-col gap-1 truncate text-on-color">
                <span className="truncate text-16 font-semibold">{watch("name")}</span>
                <span className="flex items-center gap-2 text-13">
                  <span>{watch("identifier")} .</span>
                  <span className="flex items-center gap-1.5">
                    {watch("network") === 0 && <LockIcon className="h-2.5 w-2.5 text-on-color" />}
                    {currentNetwork && t(currentNetwork.i18n_label)}
                  </span>
                </span>
              </div>
            </div>
            <div className="flex flex-shrink-0 justify-center">
              <ImagePickerPopoverView
                label={t("change_cover")}
                value={null}
                currentImage={
                  cover && (
                    <AuthenticatedAssetImage
                      asset={cover}
                      alt="Current project cover"
                      className="h-full w-full object-cover"
                    />
                  )
                }
                disabled={disabled || !policy}
                onSelect={changeCover}
                onUpload={changeCover}
              />
            </div>
          </div>
        </div>
        <fieldset disabled={disabled} className="mt-8 flex flex-col gap-8">
          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-13">
              {t("common.project_name")}
            </label>
            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <Input
                  {...field}
                  id="name"
                  type="text"
                  required
                  maxLength={255}
                  className="rounded-md !p-3 font-medium"
                  placeholder={t("common.project_name")}
                />
              )}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="description" className="text-13">
              {t("description")}
            </label>
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <TextArea
                  {...field}
                  id="description"
                  maxLength={20000}
                  placeholder={t("project_description_placeholder")}
                  className="min-h-[102px] text-13 font-medium"
                />
              )}
            />
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="identifier" className="text-13">
                Project ID
              </label>
              <div className="relative">
                <Controller
                  control={control}
                  name="identifier"
                  rules={{ required: t("project_id_is_required"), maxLength: 12 }}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="identifier"
                      type="text"
                      maxLength={12}
                      onChange={(event) => field.onChange(projectIdentifierSanitizer(event.target.value).toUpperCase())}
                      hasError={Boolean(errors.identifier)}
                      placeholder={t("project_settings.general.enter_project_id")}
                      className="w-full font-medium"
                    />
                  )}
                />
                <Tooltip
                  isMobile={isMobile}
                  tooltipContent={t("project_id_tooltip_content")}
                  className="text-13"
                  position="right-start"
                >
                  <Info className="absolute top-2.5 right-2 h-4 w-4 text-placeholder" />
                </Tooltip>
              </div>
              <span className="text-11 text-danger-primary">{errors.identifier?.message}</span>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-13">{t("workspace_projects.network.label")}</label>
              <Controller
                name="network"
                control={control}
                render={({ field }) => (
                  <CustomSelect
                    value={field.value}
                    onChange={field.onChange}
                    label={
                      <div className="flex items-center gap-1">
                        {currentNetwork && (
                          <>
                            <ProjectNetworkIcon iconKey={currentNetwork.iconKey} className="h-3.5 w-3.5" />
                            {t(currentNetwork.i18n_label)}
                          </>
                        )}
                      </div>
                    }
                    buttonClassName="!border-subtle !shadow-none font-medium rounded-md"
                    input
                    disabled={disabled}
                  >
                    {NETWORK_CHOICES.map((network) => (
                      <CustomSelect.Option key={network.key} value={network.key}>
                        <div className="flex items-start gap-2">
                          <ProjectNetworkIcon iconKey={network.iconKey} className="h-3.5 w-3.5" />
                          <div className="-mt-1">
                            <p>{t(network.i18n_label)}</p>
                            <p className="text-11 text-placeholder">{t(network.description)}</p>
                          </div>
                        </div>
                      </CustomSelect.Option>
                    ))}
                  </CustomSelect>
                )}
              />
            </div>
            <div className="col-span-1 flex flex-col gap-1 sm:col-span-2 xl:col-span-1">
              <label className="text-13">{t("common.project_timezone")}</label>
              <Controller
                name="timezone"
                control={control}
                rules={{ required: t("project_settings.general.please_select_a_timezone") }}
                render={({ field }) => (
                  <TimezoneSelect
                    value={field.value}
                    onChange={field.onChange}
                    error={Boolean(errors.timezone)}
                    buttonClassName="!border-subtle !shadow-none font-medium rounded-md"
                    disabled={disabled}
                  />
                )}
              />
              {errors.timezone && <span className="text-11 text-danger-primary">{errors.timezone.message}</span>}
            </div>
          </div>
          {error && (
            <p role="alert" className="text-13 text-danger-primary">
              {error}
            </p>
          )}
          <div className="flex items-center justify-between py-2">
            <Button variant="primary" size="lg" type="submit" loading={isSubmitting} disabled={disabled}>
              {isSubmitting ? t("updating") : t("common.update_project")}
            </Button>
            <span className="text-13 text-placeholder italic">
              {t("common.created_on")} {renderFormattedDate(new Date(project.createdAt).toISOString())}
            </span>
          </div>
        </fieldset>
      </form>
      <GeneralProjectSettingsControlSection
        project={project}
        workspaceSlug={workspaceSlug}
        disabled={isDirty || pending}
      />
    </>
  );
}
