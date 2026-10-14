/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type React from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
// local imports
import type { Pixel, TCustomImageAttributes, TCustomImageSize } from "../types";
import { ensurePixelString } from "../utils";

const MIN_SIZE = 100;

type Args = {
  editorContainer: HTMLDivElement | null;
  imageRef: React.RefObject<HTMLImageElement>;
  nodeAlignment: TCustomImageAttributes["alignment"];
  nodeAspectRatio: TCustomImageAttributes["aspectRatio"];
  nodeHeight: TCustomImageAttributes["height"];
  nodeWidth: TCustomImageAttributes["width"];
  setEditorContainer: (editorContainer: HTMLDivElement | null) => void;
  updateAttributesSafely: (attributes: Partial<TCustomImageAttributes>, errorMessage: string) => void;
};

/**
 * Owns the image block size: the initial size computed on load and pointer resizing.
 */
export const useImageResize = (args: Args) => {
  const {
    editorContainer,
    imageRef,
    nodeAlignment,
    nodeAspectRatio,
    nodeHeight,
    nodeWidth,
    setEditorContainer,
    updateAttributesSafely,
  } = args;
  // states
  const [size, setSize] = useState<TCustomImageSize>({
    width: ensurePixelString(nodeWidth, "35%") ?? "35%",
    height: ensurePixelString(nodeHeight, "auto") ?? "auto",
    aspectRatio: nodeAspectRatio || null,
  });
  const [isResizing, setIsResizing] = useState(false);
  const [initialResizeComplete, setInitialResizeComplete] = useState(false);
  // refs
  const containerRef = useRef<HTMLDivElement>(null);
  const containerRect = useRef<DOMRect | null>(null);

  const handleImageLoad = useCallback(() => {
    const img = imageRef.current;
    if (!img) return;
    const closestEditorContainer = editorContainer ?? img.closest<HTMLDivElement>(".editor-container");
    if (!closestEditorContainer) {
      console.error("Editor container not found");
      return;
    }

    setEditorContainer(closestEditorContainer);
    const aspectRatioCalculated = img.naturalWidth / img.naturalHeight;

    if (nodeWidth === "35%") {
      const editorWidth = closestEditorContainer.clientWidth;
      const initialWidth = Math.max(editorWidth * 0.35, MIN_SIZE);
      const initialHeight = initialWidth / aspectRatioCalculated;

      const initialComputedSize: TCustomImageSize = {
        width: `${Math.round(initialWidth)}px` satisfies Pixel,
        height: `${Math.round(initialHeight)}px` satisfies Pixel,
        aspectRatio: aspectRatioCalculated,
      };
      setSize(initialComputedSize);
      updateAttributesSafely(
        initialComputedSize,
        "Failed to update attributes while initializing an image for the first time:"
      );
    } else if (!nodeAspectRatio || nodeAspectRatio !== aspectRatioCalculated) {
      // as the aspect ratio in not stored for old images, we need to update the attrs
      // or if aspectRatioCalculated from the image's width and height doesn't match stored aspectRatio then also we'll update the attrs
      const newSize = { ...size, aspectRatio: aspectRatioCalculated };
      setSize(newSize);
      updateAttributesSafely(
        newSize,
        "Failed to update attributes while initializing images with width but no aspect ratio:"
      );
    }
    setInitialResizeComplete(true);
  }, [editorContainer, imageRef, nodeAspectRatio, nodeWidth, setEditorContainer, size, updateAttributesSafely]);

  // for real time resizing
  useLayoutEffect(() => {
    setSize((prevSize) => ({
      ...prevSize,
      width: ensurePixelString(nodeWidth) ?? "35%",
      height: ensurePixelString(nodeHeight) ?? "auto",
      aspectRatio: nodeAspectRatio,
    }));
  }, [nodeWidth, nodeHeight, nodeAspectRatio]);

  const handleResize = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current || !containerRect.current || !size.aspectRatio) return;

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;

      if (nodeAlignment === "right") {
        const newWidth = Math.max(containerRect.current.right - clientX, MIN_SIZE);
        const newHeight = newWidth / size.aspectRatio;
        setSize((prevSize) => ({ ...prevSize, width: `${newWidth}px`, height: `${newHeight}px` }));
      } else {
        const newWidth = Math.max(clientX - containerRect.current.left, MIN_SIZE);
        const newHeight = newWidth / size.aspectRatio;
        setSize((prevSize) => ({ ...prevSize, width: `${newWidth}px`, height: `${newHeight}px` }));
      }
    },
    [nodeAlignment, size.aspectRatio]
  );

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    updateAttributesSafely(size, "Failed to update attributes at the end of resizing:");
  }, [size, updateAttributesSafely]);

  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    if (containerRef.current) {
      containerRect.current = containerRef.current.getBoundingClientRect();
    }
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    window.addEventListener("mousemove", handleResize);
    window.addEventListener("mouseup", handleResizeEnd);
    window.addEventListener("mouseleave", handleResizeEnd);
    window.addEventListener("touchmove", handleResize, { passive: true });
    window.addEventListener("touchend", handleResizeEnd);

    return () => {
      window.removeEventListener("mousemove", handleResize);
      window.removeEventListener("mouseup", handleResizeEnd);
      window.removeEventListener("mouseleave", handleResizeEnd);
      window.removeEventListener("touchmove", handleResize);
      window.removeEventListener("touchend", handleResizeEnd);
    };
  }, [isResizing, handleResize, handleResizeEnd]);

  return { containerRef, handleImageLoad, handleResizeStart, initialResizeComplete, isResizing, size };
};
