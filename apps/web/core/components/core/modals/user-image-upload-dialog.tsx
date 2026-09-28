/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useDropzone } from "react-dropzone";
import { ACCEPTED_AVATAR_IMAGE_MIME_TYPES_FOR_REACT_DROPZONE, MAX_FILE_SIZE } from "@plane/constants";
import { Button } from "@plane/propel/button";
import { Dialog } from "@plane/propel/dialog";
import { UserCirclePropertyIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
type Props = {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
  currentImage: ReactNode;
  imageAlt?: string;
};
export function UserImageUploadDialog(props: Props) {
  const { onRemove, onUpload, isOpen, onClose, currentImage, imageAlt = "Profile avatar" } = props;
  // states
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!image) {
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const pending = isRemoving || isImageUploading;

  const onDrop = ([file]: File[]) => {
    if (file) setImage(file);
  };

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: ACCEPTED_AVATAR_IMAGE_MIME_TYPES_FOR_REACT_DROPZONE,
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    disabled: pending,
  });

  const handleClose = () => {
    if (pending) return;
    setImage(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!image || pending) return;
    setIsImageUploading(true);

    try {
      await onUpload(image);
      setImage(null);
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: error?.toString() ?? "Something went wrong. Please try again.",
      });
    } finally {
      setIsImageUploading(false);
    }
  };

  const handleImageRemove = async () => {
    if (!currentImage || pending) return;
    setIsRemoving(true);
    try {
      await onRemove();
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: error?.toString() ?? "The image could not be removed. Please try again.",
      });
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={handleClose} position={EModalPosition.CENTER} width={EModalWidth.XL}>
      <div className="space-y-5 px-5 py-8 sm:p-6">
        <Dialog.Title className="text-16 leading-6 font-medium text-primary">Upload Image</Dialog.Title>
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-3">
            <div
              {...getRootProps({ role: "button", "aria-label": "Choose an image", "aria-disabled": pending })}
              className={`relative grid aspect-square w-80 max-w-full cursor-pointer place-items-center rounded-lg p-12 text-center focus:ring-2 focus:ring-accent-strong focus:ring-offset-2 focus:outline-none ${
                (image === null && isDragActive) || !currentImage
                  ? "border-2 border-dashed border-subtle hover:bg-surface-2"
                  : ""
              }`}
            >
              {image !== null || currentImage ? (
                <>
                  <span className="absolute top-0 right-0 z-40 translate-x-1/2 -translate-y-1/2 rounded-sm bg-surface-2 px-2 py-0.5 text-11 font-medium text-secondary">
                    Edit
                  </span>
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={imageAlt}
                      className="absolute top-0 left-0 h-full w-full rounded-md object-cover"
                    />
                  ) : (
                    currentImage
                  )}
                </>
              ) : (
                <div>
                  <UserCirclePropertyIcon className="mx-auto h-16 w-16 text-secondary" />
                  <span className="mt-2 block text-13 font-medium text-secondary">
                    {isDragActive ? "Drop image here to upload" : "Drag & drop image here"}
                  </span>
                </div>
              )}

              <input {...getInputProps()} />
            </div>
          </div>
          {fileRejections.length > 0 && (
            <p className="text-13 text-danger-primary">
              {fileRejections[0].errors[0].code === "file-too-large"
                ? "The image size cannot exceed 5 MB."
                : "Please upload a file in a valid format."}
            </p>
          )}
        </div>
        <p className="my-4 text-13 text-secondary">File formats supported- .jpeg, .jpg, .png, .webp</p>
        <div className="flex items-center justify-between">
          <Button variant="error-fill" size="lg" onClick={handleImageRemove} disabled={!currentImage || pending}>
            {isRemoving ? "Removing" : "Remove"}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="lg" onClick={handleClose} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="lg"
              onClick={handleSubmit}
              disabled={!image || pending}
              loading={isImageUploading}
            >
              {isImageUploading ? "Uploading" : "Upload & Save"}
            </Button>
          </div>
        </div>
      </div>
    </ModalCore>
  );
}
