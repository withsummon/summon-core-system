/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { ORGANIZATION_SIZE } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { EditIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { CustomSelect, Input } from "@plane/ui";
import { cn, copyUrlToClipboard } from "@plane/utils";
import { WorkspaceImageUploadModal } from "@/components/core/modals/workspace-image-upload-modal";
import { TimezoneSelect } from "@/components/global/timezone-select";
import { AuthenticatedAssetImage } from "@/components/convex-core/assets/image";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { DeleteWorkspaceSection } from "@/components/workspace/delete-workspace-section";

export function WorkspaceDetails({
  workspaceId,
  metadata,
  beforeDelete,
}: {
  workspaceId: Id<"workspaces">;
  metadata: FunctionReturnType<typeof api.settings.index.metadata>;
  beforeDelete: () => Promise<void>;
}) {
  const [isImageUploadModalOpen, setIsImageUploadModalOpen] = useState(false);
  const { t } = useTranslation();
  const save = useMutation(api.settings.index.update);
  const appearance = useQuery(api.settings.logo.get, { workspaceId });
  const { revision, canManage, ...fields } = metadata;
  const values = { workspaceId, ...fields, expectedRevision: revision } satisfies FunctionArgs<
    typeof api.settings.index.update
  >;
  const {
    handleSubmit,
    control,
    register,
    reset,
    watch,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FunctionArgs<typeof api.settings.index.update>>({ defaultValues: values });
  const expectedRevision = watch("expectedRevision");
  const stale = revision > expectedRevision;
  const locked = !canManage || isSubmitting || isImageUploadModalOpen;
  const workspaceUrl = `${window.location.origin}/${metadata.slug}`;
  const acknowledge = (starting: number, committed: number) => {
    if (getValues("expectedRevision") === starting) setValue("expectedRevision", committed);
  };
  const onSubmit = async (input: FunctionArgs<typeof api.settings.index.update>) => {
    try {
      const receipt = await save(input);
      acknowledge(input.expectedRevision, receipt.revision);
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Success!", message: "Workspace updated successfully." });
    } catch (failure) {
      setToast({ type: TOAST_TYPE.ERROR, title: t("toast.error"), message: mutationMessage(failure) });
    }
  };
  const handleCopyUrl = async () => {
    try {
      await copyUrlToClipboard(workspaceUrl);
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Workspace URL copied to the clipboard." });
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Unable to copy the workspace URL. Please try again." });
    }
  };
  if (!appearance) return <p role="status">Loading workspace details…</p>;

  return (
    <>
      {isImageUploadModalOpen && (
        <WorkspaceImageUploadModal
          workspaceId={workspaceId}
          appearance={appearance}
          expectedRevision={expectedRevision}
          onClose={() => setIsImageUploadModalOpen(false)}
          onSuccess={(receipt) => {
            acknowledge(receipt.startingRevision, receipt.revision);
            setIsImageUploadModalOpen(false);
          }}
        />
      )}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className={cn("flex w-full flex-col gap-y-7", { "opacity-60": !canManage })}
      >
        <div className="flex items-center gap-5">
          <div className="flex shrink-0 flex-col gap-1">
            <button
              type="button"
              aria-label={t("workspace_settings.settings.general.edit_logo")}
              onClick={() => setIsImageUploadModalOpen(true)}
              disabled={locked || stale}
            >
              {appearance.logo ? (
                <div className="relative flex size-14">
                  <AuthenticatedAssetImage
                    asset={appearance.logo}
                    alt="Workspace logo"
                    className="absolute top-0 left-0 size-full rounded-md object-cover"
                  />
                </div>
              ) : (
                <div className="relative grid size-14 place-items-center rounded-md bg-accent-primary text-24 text-on-color uppercase">
                  {metadata.name.charAt(0)}
                </div>
              )}
            </button>
          </div>
          <div className="flex flex-col gap-1">
            <div className="mb:-my-5 text-h5-semibold leading-6">{watch("name")}</div>
            <button type="button" onClick={handleCopyUrl} className="text-left text-body-xs-regular tracking-tight">
              {workspaceUrl.replace(/^https?:\/\//, "")}
            </button>
            {canManage && (
              <button
                type="button"
                className="flex items-center gap-1.5 text-left text-caption-sm-medium text-accent-primary"
                onClick={() => setIsImageUploadModalOpen(true)}
                disabled={locked || stale}
              >
                {appearance.logo ? (
                  <>
                    <EditIcon className="h-3 w-3" />
                    {t("workspace_settings.settings.general.edit_logo")}
                  </>
                ) : (
                  t("workspace_settings.settings.general.upload_logo")
                )}
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-7">
          <div className="grid-col grid w-full grid-cols-1 items-center justify-between gap-10 xl:grid-cols-2 2xl:grid-cols-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="name" className="text-body-sm-medium text-tertiary">
                {t("workspace_settings.settings.general.name")}
              </label>
              <Input
                id="name"
                type="text"
                {...register("name", { required: "Workspace name is required." })}
                maxLength={80}
                hasError={Boolean(errors.name)}
                placeholder={t("workspace_settings.settings.general.name")}
                className="w-full rounded-md"
                disabled={locked}
              />
              {errors.name && <p className="text-caption-sm-regular text-danger-primary">{errors.name.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <h4 className="text-body-sm-medium text-tertiary">
                {t("workspace_settings.settings.general.company_size")}
              </h4>
              <Controller
                name="organizationSize"
                control={control}
                render={({ field }) => (
                  <CustomSelect
                    value={field.value}
                    onChange={field.onChange}
                    ariaLabel={t("workspace_settings.settings.general.company_size")}
                    label={field.value || t("workspace_settings.settings.general.errors.company_size.select_a_range")}
                    buttonClassName="border border-subtle bg-layer-2 !shadow-none !rounded-md"
                    input
                    disabled={locked}
                  >
                    {ORGANIZATION_SIZE.map((item) => (
                      <CustomSelect.Option key={item} value={item}>
                        {item}
                      </CustomSelect.Option>
                    ))}
                  </CustomSelect>
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="workspaceUrl" className="text-body-sm-medium text-tertiary">
                {t("workspace_settings.settings.general.url")}
              </label>
              <Input
                id="workspaceUrl"
                type="text"
                value={workspaceUrl.replace(/^https?:\/\//, "")}
                className="w-full cursor-not-allowed rounded-md !bg-layer-1"
                disabled
              />
            </div>
            <div className="flex flex-col gap-2">
              <h4 className="text-body-sm-medium text-tertiary">
                {t("workspace_settings.settings.general.workspace_timezone")}
              </h4>
              <Controller
                name="timezone"
                control={control}
                render={({ field }) => (
                  <TimezoneSelect
                    value={field.value}
                    onChange={field.onChange}
                    disabled={locked}
                    ariaLabel={t("workspace_settings.settings.general.workspace_timezone")}
                  />
                )}
              />
            </div>
          </div>
        </div>
        {stale && (
          <p role="status" className="text-body-sm-regular text-secondary">
            Workspace settings changed. Reload the latest settings before saving. Your edits will be replaced.{" "}
            <button
              type="button"
              className="text-accent-primary underline"
              disabled={isSubmitting || isImageUploadModalOpen}
              onClick={() => reset(values)}
            >
              Reload settings
            </button>
          </p>
        )}
        {canManage && (
          <div className="flex items-center justify-between py-2">
            <Button variant="primary" size="lg" type="submit" disabled={locked || stale} loading={isSubmitting}>
              {isSubmitting ? t("updating") : t("workspace_settings.settings.general.update_workspace")}
            </Button>
          </div>
        )}
      </form>
      {canManage && (
        <div className="mt-10">
          <DeleteWorkspaceSection
            workspaceId={workspaceId}
            name={metadata.name}
            expectedRevision={expectedRevision}
            disabled={locked || stale}
            beforeDelete={beforeDelete}
          />
        </div>
      )}
    </>
  );
}
