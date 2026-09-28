/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { observer } from "mobx-react";
import { EFileAssetType } from "@plane/types";
import { getAssetIdFromUrl, getFileURL, checkURLValidity } from "@plane/utils";
import { FileService } from "@/services/file.service";
import { UserImageUploadDialog } from "./user-image-upload-dialog";
const fileService = new FileService();
type Props = {
  handleRemove: () => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (url: string) => void;
  value: string | null;
};
export const UserImageUploadModal = observer(function UserImageUploadModal({
  value,
  handleRemove,
  onSuccess,
  ...props
}: Props) {
  return (
    <UserImageUploadDialog
      {...props}
      currentImage={
        value ? (
          <img
            src={getFileURL(value)}
            alt="Profile avatar"
            className="absolute top-0 left-0 h-full w-full rounded-md object-cover"
          />
        ) : null
      }
      onUpload={async (image) => {
        const { asset_url } = await fileService.uploadUserAsset(
          { entity_identifier: "", entity_type: EFileAssetType.USER_AVATAR },
          image
        );
        onSuccess(asset_url);
      }}
      onRemove={async () => {
        if (!value) return;
        if (checkURLValidity(value)) await fileService.deleteOldUserAsset(value);
        else await fileService.deleteUserAsset(getAssetIdFromUrl(value));
        await handleRemove();
      }}
    />
  );
});
