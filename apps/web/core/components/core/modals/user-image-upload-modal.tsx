/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { EFileAssetType } from "@plane/types";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
import { getAssetIdFromUrl, checkURLValidity } from "@plane/utils";
// services
import { FileService } from "@/services/file.service";
// local
import { ImageUploadDropzone } from "./image-upload-dropzone";
const fileService = new FileService();

type Props = {
  handleRemove: () => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (url: string) => void;
  value: string | null;
};

export const UserImageUploadModal = observer(function UserImageUploadModal(props: Props) {
  const { handleRemove, isOpen, onClose, onSuccess, value } = props;
  // states
  const [image, setImage] = useState<File | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);

  const handleClose = () => {
    setImage(null);
    setIsImageUploading(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!image) return;
    setIsImageUploading(true);

    try {
      const { asset_url } = await fileService.uploadUserAsset(
        {
          entity_identifier: "",
          entity_type: EFileAssetType.USER_AVATAR,
        },
        image
      );
      onSuccess(asset_url);
      setImage(null);
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: error?.toString() ?? "Something went wrong. Please try again.",
      });
      throw new Error("Error in uploading file.");
    } finally {
      setIsImageUploading(false);
    }
  };

  const handleImageRemove = async () => {
    if (!value) return;
    setIsRemoving(true);
    try {
      if (checkURLValidity(value)) {
        await fileService.deleteOldUserAsset(value);
      } else {
        const assetId = getAssetIdFromUrl(value);
        await fileService.deleteUserAsset(assetId);
      }
      await handleRemove();
    } catch (error) {
      console.log("Error in uploading user asset:", error);
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={handleClose} position={EModalPosition.CENTER} width={EModalWidth.XL}>
      <div className="space-y-5 px-5 py-8 sm:p-6">
        <h3 className="text-16 leading-6 font-medium text-primary">Upload Image</h3>
        <ImageUploadDropzone image={image} onImageChange={setImage} value={value} previewAlt="Avatar preview" />
        <p className="my-4 text-13 text-secondary">File formats supported- .jpeg, .jpg, .png, .webp</p>
        <div className="flex items-center justify-between">
          <Button variant="error-fill" size="lg" onClick={handleImageRemove} disabled={!value}>
            {isRemoving ? "Removing" : "Remove"}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="lg" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="primary" size="lg" onClick={handleSubmit} disabled={!image} loading={isImageUploading}>
              {isImageUploading ? "Uploading" : "Upload & Save"}
            </Button>
          </div>
        </div>
      </div>
    </ModalCore>
  );
});
