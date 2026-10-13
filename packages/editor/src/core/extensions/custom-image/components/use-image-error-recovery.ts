/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type React from "react";
import { useCallback, useRef, useState } from "react";
// local imports
import type { CustomImageExtensionType } from "../types";

type Args = {
  extension: CustomImageExtensionType;
  imageRef: React.RefObject<HTMLImageElement>;
  imgNodeSrc: string | null;
  isTouchDevice: boolean;
  resolvedImageSrc: string | undefined;
  setFailedToLoadImage: (isError: boolean) => void;
};

/**
 * Restores the image once when it fails to load, then falls back to the error state.
 */
export const useImageErrorRecovery = (args: Args) => {
  const { extension, imageRef, imgNodeSrc, isTouchDevice, resolvedImageSrc, setFailedToLoadImage } = args;
  const [hasErroredOnFirstLoad, setHasErroredOnFirstLoad] = useState(false);
  const hasTriedRestoringImageOnce = useRef(false);

  const restoreImage = useCallback(async () => {
    // for old image extension this command doesn't exist or if the image failed to load for the first time
    if (!extension.options.restoreImage || hasTriedRestoringImageOnce.current) {
      setFailedToLoadImage(true);
      return;
    }

    try {
      setHasErroredOnFirstLoad(true);
      // this is a type error from tiptap, don't remove await until it's fixed
      if (!imgNodeSrc) {
        throw new Error("No source image to restore from");
      }
      await extension.options.restoreImage?.(imgNodeSrc);
      if (!imageRef.current) {
        throw new Error("Image reference not found");
      }
      if (!resolvedImageSrc) {
        throw new Error("No resolved image source available");
      }
      if (isTouchDevice) {
        const refreshedSrc = await extension.options.getImageSource?.(imgNodeSrc);
        imageRef.current.src = refreshedSrc;
      } else {
        imageRef.current.src = resolvedImageSrc;
      }
    } catch (error) {
      // if the image failed to even restore, then show the error state
      setFailedToLoadImage(true);
      console.error("Error while loading image", error);
    } finally {
      setHasErroredOnFirstLoad(false);
      hasTriedRestoringImageOnce.current = true;
    }
  }, [extension, imageRef, imgNodeSrc, isTouchDevice, resolvedImageSrc, setFailedToLoadImage]);

  const handleImageError = useCallback(() => void restoreImage(), [restoreImage]);

  return { handleImageError, hasErroredOnFirstLoad };
};
