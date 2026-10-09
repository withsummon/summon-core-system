/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import { Controller, useFormContext } from "react-hook-form";
// plane imports
import { ETabIndices } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { EmojiPicker, EmojiIconPickerTypes, Logo } from "@plane/propel/emoji-icon-picker";
import { CloseIcon } from "@plane/propel/icons";
// plane types
import type { IProject } from "@plane/types";
// plane ui
import { getTabIndex } from "@plane/utils";
// components
import { CoverImage } from "@/components/common/cover-image";
import { ImagePickerPopover } from "@/components/core/image-picker-popover";

type Props = {
  handleClose: () => void;
  isMobile?: boolean;
  handleFormOnChange?: () => void;
  isClosable?: boolean;
  handleTemplateSelect?: () => void;
  showActionButtons?: boolean;
};

function ProjectCreateHeader(props: Props) {
  const { handleClose, isMobile = false, handleFormOnChange, isClosable = true } = props;
  const { watch, control } = useFormContext<IProject>();
  const { t } = useTranslation();
  // derived values
  const coverImage = watch("cover_image_url");

  const { getIndex } = getTabIndex(ETabIndices.PROJECT_CREATE, isMobile);

  return (
    <ProjectCreateHeaderView
      handleClose={handleClose}
      isClosable={isClosable}
      closeTabIndex={getIndex("close")}
      cover={
        <CoverImage
          src={coverImage}
          alt={t("project_cover_image_alt")}
          className="absolute top-0 left-0 h-full w-full rounded-lg"
        />
      }
      coverPicker={
        <Controller
          name="cover_image_url"
          control={control}
          render={({ field: { value, onChange } }) => (
            <ImagePickerPopover
              label={t("change_cover")}
              onChange={(data) => {
                onChange(data);
                handleFormOnChange?.();
              }}
              value={value ?? null}
              tabIndex={getIndex("cover_image")}
            />
          )}
        />
      }
      logoPicker={
        <Controller
          name="logo_props"
          control={control}
          render={({ field: { value, onChange } }) => (
            <ProjectLogoPicker
              value={value}
              onChange={(logo) => {
                onChange(logo);
                handleFormOnChange?.();
              }}
            />
          )}
        />
      }
    />
  );
}

export default ProjectCreateHeader;

export function ProjectCreateHeaderView({
  handleClose,
  isClosable = true,
  closeTabIndex,
  disabled = false,
  cover,
  coverPicker,
  logoPicker,
}: {
  handleClose: () => void;
  isClosable?: boolean;
  closeTabIndex?: number;
  disabled?: boolean;
  cover: ReactNode;
  coverPicker: ReactNode;
  logoPicker: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="group relative h-44 w-full rounded-lg">
      {cover}
      {isClosable && (
        <div className="absolute top-2 right-2 p-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={disabled}
            aria-label={t("close")}
            tabIndex={closeTabIndex}
          >
            <CloseIcon className="h-5 w-5 text-on-color" />
          </button>
        </div>
      )}
      <div className="absolute right-2 bottom-2">{coverPicker}</div>
      <div className="absolute -bottom-[22px] left-3">{logoPicker}</div>
    </div>
  );
}

export function ProjectLogoPicker({
  value,
  onChange,
  disabled = false,
  iconType = "material",
}: {
  value: ComponentProps<typeof Logo>["logo"];
  onChange: (logo: NonNullable<ComponentProps<typeof Logo>["logo"]>) => void;
  disabled?: boolean;
  iconType?: ComponentProps<typeof EmojiPicker>["iconType"];
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <EmojiPicker
      iconType={iconType}
      isOpen={isOpen && !disabled}
      handleToggle={setIsOpen}
      disabled={disabled}
      className="flex items-center justify-center"
      buttonClassName="flex items-center justify-center"
      label={
        <span className="grid h-11 w-11 place-items-center rounded-md border border-subtle bg-layer-2">
          <Logo logo={value} size={20} type={iconType} />
        </span>
      }
      onChange={(choice) =>
        onChange(
          choice.type === "emoji"
            ? { in_use: choice.type, emoji: { value: choice.value } }
            : { in_use: choice.type, icon: choice.value }
        )
      }
      defaultIconColor={value?.in_use === "icon" ? value.icon?.color : undefined}
      defaultOpen={value?.in_use === "emoji" ? EmojiIconPickerTypes.EMOJI : EmojiIconPickerTypes.ICON}
    />
  );
}
