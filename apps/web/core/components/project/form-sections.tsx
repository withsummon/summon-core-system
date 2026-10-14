/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { Control, FieldErrors, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { Controller } from "react-hook-form";
import { Info } from "lucide-react";
import { NETWORK_CHOICES } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
// plane imports
import { EmojiPicker, EmojiIconPickerTypes, Logo } from "@plane/propel/emoji-icon-picker";
import { LockIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Tooltip } from "@plane/propel/tooltip";
import type { IProject } from "@plane/types";
import { CustomSelect, Input } from "@plane/ui";
import { CoverImage } from "@/components/common/cover-image";
import { ImagePickerPopover } from "@/components/core/image-picker-popover";
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";
// local imports
import { ProjectNetworkIcon } from "./project-network-icon";
import { ProjectNetworkOptions } from "./project-network-options";

type TTranslate = ReturnType<typeof useTranslation>["t"];

const PROJECT_UPDATE_ERROR_MESSAGES = [
  { field: "name", code: "PROJECT_NAME_ALREADY_EXIST", messageKey: "project_name_already_taken" },
  { field: "identifier", code: "PROJECT_IDENTIFIER_ALREADY_EXIST", messageKey: "project_identifier_already_taken" },
  {
    field: "name",
    code: "PROJECT_NAME_CANNOT_CONTAIN_SPECIAL_CHARACTERS",
    messageKey: "project_name_cannot_contain_special_characters",
  },
] as const;

/** Shows one toast per known field error code returned by the project update API, or a generic one. */
export const showProjectUpdateErrorToasts = (err: unknown, t: TTranslate) => {
  try {
    // Handle the new error format where codes are nested in arrays under field names
    const errorData = (err ?? {}) as Partial<Record<string, string[]>>;
    const matchedErrors = PROJECT_UPDATE_ERROR_MESSAGES.filter(({ field, code }) => errorData[field]?.includes(code));
    const messageKeys = matchedErrors.length > 0 ? matchedErrors.map((e) => e.messageKey) : ["something_went_wrong"];
    messageKeys.forEach((messageKey) =>
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("toast.error"),
        message: t(messageKey),
      })
    );
  } catch (error) {
    // Fallback error handling if the error processing fails
    console.error("Error processing API error:", error);
    setToast({
      type: TOAST_TYPE.ERROR,
      title: t("toast.error"),
      message: t("something_went_wrong"),
    });
  }
};

type TProjectFormHeaderProps = {
  project: IProject;
  control: Control<IProject>;
  watch: UseFormWatch<IProject>;
  isAdmin: boolean;
};

export function ProjectFormHeader({ project, control, watch, isAdmin }: TProjectFormHeaderProps) {
  const { t } = useTranslation();
  // states
  const [isOpen, setIsOpen] = useState(false);
  // derived values
  const currentNetwork = NETWORK_CHOICES.find((n) => n.key === project?.network);
  const coverImage = watch("cover_image_url");

  return (
    <div className="relative h-44 w-full">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      <CoverImage src={coverImage} alt="Project cover image" className="h-44 w-full rounded-md" />
      <div className="absolute bottom-4 z-5 flex w-full items-end justify-between gap-3 px-4">
        <div className="flex flex-grow gap-3 truncate">
          <Controller
            control={control}
            name="logo_props"
            render={({ field: { value, onChange } }) => (
              <EmojiPicker
                iconType="material"
                closeOnSelect={false}
                isOpen={isOpen}
                handleToggle={(val: boolean) => setIsOpen(val)}
                className="flex items-center justify-center"
                buttonClassName="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-lg bg-white/10"
                label={<Logo logo={value} size={28} />}
                // TODO: fix types
                onChange={(val: any) => {
                  let logoValue = {};

                  if (val?.type === "emoji")
                    logoValue = {
                      value: val.value,
                    };
                  else if (val?.type === "icon") logoValue = val.value;

                  onChange({
                    in_use: val?.type,
                    [val?.type]: logoValue,
                  });
                  setIsOpen(false);
                }}
                defaultIconColor={value?.in_use && value.in_use === "icon" ? value?.icon?.color : undefined}
                defaultOpen={
                  value.in_use && value.in_use === "emoji" ? EmojiIconPickerTypes.EMOJI : EmojiIconPickerTypes.ICON
                }
                disabled={!isAdmin}
              />
            )}
          />
          <div className="flex flex-col gap-1 truncate text-on-color">
            <span className="truncate text-16 font-semibold">{watch("name")}</span>
            <span className="flex items-center gap-2 text-13">
              <span>{watch("identifier")} .</span>
              <span className="flex items-center gap-1.5">
                {project.network === 0 && <LockIcon className="h-2.5 w-2.5 text-on-color" />}
                {currentNetwork && t(currentNetwork?.i18n_label)}
              </span>
            </span>
          </div>
        </div>
        <div className="flex flex-shrink-0 justify-center">
          <div>
            <Controller
              control={control}
              name="cover_image_url"
              render={({ field: { value, onChange } }) => (
                <ImagePickerPopover
                  label={t("change_cover")}
                  control={control}
                  onChange={onChange}
                  value={value ?? null}
                  disabled={!isAdmin}
                  projectId={project.id}
                />
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

type TProjectIdentifierFieldProps = {
  control: Control<IProject>;
  errors: FieldErrors<IProject>;
  setValue: UseFormSetValue<IProject>;
  isAdmin: boolean;
};

export function ProjectIdentifierField({ control, errors, setValue, isAdmin }: TProjectIdentifierFieldProps) {
  const { t } = useTranslation();
  const { isMobile } = usePlatformOS();

  const handleIdentifierChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    const alphanumericValue = value.replace(/[^a-zA-Z0-9]/g, "");
    const formattedValue = alphanumericValue.toUpperCase();
    setValue("identifier", formattedValue);
  };

  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-13">Project ID</h4>
      <div className="relative">
        <Controller
          control={control}
          name="identifier"
          rules={{
            required: t("project_id_is_required"),
            validate: (value) => /^[ÇŞĞIİÖÜA-Z0-9]+$/.test(value.toUpperCase()) || t("project_id_allowed_char"),
            minLength: {
              value: 1,
              message: t("project_id_min_char"),
            },
            maxLength: {
              value: 10,
              message: t("project_id_max_char"),
            },
          }}
          render={({ field: { value, ref } }) => (
            <Input
              id="identifier"
              name="identifier"
              type="text"
              value={value}
              onChange={handleIdentifierChange}
              ref={ref}
              hasError={Boolean(errors.identifier)}
              placeholder={t("project_settings.general.enter_project_id")}
              className="w-full font-medium"
              disabled={!isAdmin}
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
      <span className="text-11 text-danger-primary">
        <>{errors?.identifier?.message}</>
      </span>
    </div>
  );
}

export function ProjectNetworkField({ control, isAdmin }: { control: Control<IProject>; isAdmin: boolean }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-13">{t("workspace_projects.network.label")}</h4>
      <Controller
        name="network"
        control={control}
        render={({ field: { value, onChange } }) => {
          const selectedNetwork = NETWORK_CHOICES.find((n) => n.key === value);
          return (
            <CustomSelect
              value={value}
              onChange={onChange}
              label={
                <div className="flex items-center gap-1">
                  {selectedNetwork ? (
                    <>
                      <ProjectNetworkIcon iconKey={selectedNetwork.iconKey} className="h-3.5 w-3.5" />
                      {t(selectedNetwork.i18n_label)}
                    </>
                  ) : (
                    <span className="text-placeholder">{t("select_network")}</span>
                  )}
                </div>
              }
              input
              disabled={!isAdmin}
              // optionsClassName="w-full"
            >
              <ProjectNetworkOptions />
            </CustomSelect>
          );
        }}
      />
    </div>
  );
}
