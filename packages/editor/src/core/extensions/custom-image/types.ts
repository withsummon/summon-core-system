/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Node } from "@tiptap/core";
// types
import type { TFileHandler } from "@/types";
import { ECustomImageAttributeNames, ECustomImageStatus } from "./contract";
export { ECustomImageAttributeNames, ECustomImageStatus } from "./contract";

export type Pixel = `${number}px`;

export type PixelAttribute<TDefault> = Pixel | TDefault;

export type TCustomImageSize = {
  width: PixelAttribute<"35%">;
  height: PixelAttribute<"auto">;
  aspectRatio: number | null;
};

export type TCustomImageAlignment = "left" | "center" | "right";

export type TCustomImageAttributes = {
  [ECustomImageAttributeNames.ID]: string | null;
  [ECustomImageAttributeNames.WIDTH]: PixelAttribute<"35%" | number> | null;
  [ECustomImageAttributeNames.HEIGHT]: PixelAttribute<"auto" | number> | null;
  [ECustomImageAttributeNames.ASPECT_RATIO]: number | null;
  [ECustomImageAttributeNames.SOURCE]: string | null;
  [ECustomImageAttributeNames.ALIGNMENT]: TCustomImageAlignment;
  [ECustomImageAttributeNames.STATUS]: ECustomImageStatus;
};

export type UploadEntity = ({ event: "insert" } | { event: "drop"; file: File }) & { hasOpenedFileInputOnce?: boolean };

export type InsertImageComponentProps = {
  file?: File;
  pos?: number;
  event: "insert" | "drop";
};

export type CustomImageExtensionOptions = {
  getImageDownloadSource: TFileHandler["getAssetDownloadSrc"];
  getImageSource: TFileHandler["getAssetSrc"];
  restoreImage: TFileHandler["restore"];
  uploadImage?: TFileHandler["upload"];
  duplicateImage?: TFileHandler["duplicate"];
};

export type CustomImageExtensionStorage = {
  fileMap: Map<string, UploadEntity>;
  deletedImageSet: Map<string, boolean>;
  maxFileSize: number;
};

export type CustomImageExtensionType = Node<CustomImageExtensionOptions, CustomImageExtensionStorage>;
