/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { NodeSelection } from "@tiptap/pm/state";
import { useRef, useCallback } from "react";
// plane imports
import { cn } from "@plane/utils";
// local imports
import { ECustomImageAttributeNames } from "../types";
import type { TCustomImageAttributes } from "../types";
import { getImageBlockId, isImageDuplicating } from "../utils";
import type { CustomImageNodeViewProps } from "./node-view";
import { ImageToolbarRoot } from "./toolbar";
import { ImageResizeHandles } from "./resize-handles";
import { ImageUploadStatus } from "./upload-status";
import { useImageErrorRecovery } from "./use-image-error-recovery";
import { useImageResize } from "./use-image-resize";

type CustomImageBlockProps = CustomImageNodeViewProps & {
  editorContainer: HTMLDivElement | null;
  imageFromFileSystem: string | undefined;
  setEditorContainer: (editorContainer: HTMLDivElement | null) => void;
  setFailedToLoadImage: (isError: boolean) => void;
  src: string | undefined;
  downloadSrc: string | undefined;
};

type VisibilityArgs = {
  hasErroredOnFirstLoad: boolean;
  imageFromFileSystem: string | undefined;
  initialResizeComplete: boolean;
  isEditable: boolean;
  resolvedDownloadSrc: string | undefined;
  resolvedImageSrc: string | undefined;
  status: TCustomImageAttributes["status"];
};

const getImageBlockVisibility = (args: VisibilityArgs) => {
  const {
    hasErroredOnFirstLoad,
    imageFromFileSystem,
    initialResizeComplete,
    isEditable,
    resolvedDownloadSrc,
    resolvedImageSrc,
    status,
  } = args;
  const isDuplicating = isImageDuplicating(status);
  // show the image loader if the remote image's src or preview image from filesystem is not set yet (while loading the image post upload) (or)
  // if the initial resize (from 35% width and "auto" height attrs to the actual size in px) is not complete
  const showImageLoader =
    (!resolvedImageSrc && !isDuplicating) || !initialResizeComplete || hasErroredOnFirstLoad || isDuplicating; // show the image upload status only when the resolvedImageSrc is not ready
  const showUploadStatus = !resolvedImageSrc && !isDuplicating;
  // show the image utils only if the remote image's (post upload) src is set and the initial resize is complete (but not while we're showing the preview imageFromFileSystem)
  const toolbarSources =
    resolvedImageSrc && resolvedDownloadSrc && initialResizeComplete && !isDuplicating
      ? { src: resolvedImageSrc, downloadSrc: resolvedDownloadSrc }
      : null;
  // show the image resizer only if the editor is editable, the remote image's (post upload) src is set and the initial resize is complete (but not while we're showing the preview imageFromFileSystem)
  const showImageResizer = isEditable && resolvedImageSrc && initialResizeComplete && !isDuplicating;
  // show the preview image from the file system if the remote image's src is not set
  const displayedImageSrc = resolvedImageSrc || imageFromFileSystem;

  return { displayedImageSrc, showImageLoader, showImageResizer, showUploadStatus, toolbarSources };
};

export function CustomImageBlock(props: CustomImageBlockProps) {
  // props
  const {
    editor,
    editorContainer,
    extension,
    getPos,
    imageFromFileSystem,
    node,
    selected,
    setEditorContainer,
    setFailedToLoadImage,
    src: resolvedImageSrc,
    downloadSrc: resolvedDownloadSrc,
    updateAttributes,
  } = props;
  const {
    width: nodeWidth,
    height: nodeHeight,
    aspectRatio: nodeAspectRatio,
    src: imgNodeSrc,
    alignment: nodeAlignment,
    status,
  } = node.attrs;
  // refs
  const imageRef = useRef<HTMLImageElement>(null);
  // extension options
  const isTouchDevice = !!(editor.storage.utility as { isTouchDevice?: boolean } | undefined)?.isTouchDevice;

  const updateAttributesSafely = useCallback(
    (attributes: Partial<TCustomImageAttributes>, errorMessage: string) => {
      try {
        updateAttributes(attributes);
      } catch (error) {
        console.error(`${errorMessage}:`, error);
      }
    },
    [updateAttributes]
  );
  const { containerRef, handleImageLoad, handleResizeStart, initialResizeComplete, isResizing, size } = useImageResize({
    editorContainer,
    imageRef,
    nodeAlignment,
    nodeAspectRatio,
    nodeHeight,
    nodeWidth,
    setEditorContainer,
    updateAttributesSafely,
  });
  const { handleImageError, hasErroredOnFirstLoad } = useImageErrorRecovery({
    extension,
    imageRef,
    imgNodeSrc,
    isTouchDevice,
    resolvedImageSrc,
    setFailedToLoadImage,
  });

  const handleImageMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isTouchDevice) {
        e.preventDefault();
        editor.commands.blur();
      }
      const pos = getPos();
      if (pos === undefined) return;
      const nodeSelection = NodeSelection.create(editor.state.doc, pos);
      editor.view.dispatch(editor.state.tr.setSelection(nodeSelection));
    },
    [editor, getPos, isTouchDevice]
  );

  const { displayedImageSrc, showImageLoader, showImageResizer, showUploadStatus, toolbarSources } =
    getImageBlockVisibility({
      hasErroredOnFirstLoad,
      imageFromFileSystem,
      initialResizeComplete,
      isEditable: editor.isEditable,
      resolvedDownloadSrc,
      resolvedImageSrc,
      status,
    });

  return (
    <div
      id={
        node.attrs[ECustomImageAttributeNames.ID]
          ? getImageBlockId(node.attrs[ECustomImageAttributeNames.ID])
          : undefined
      }
      className={cn("w-fit max-w-full transition-[margin-left,translate]", {
        "ml-[50%] -translate-x-1/2": nodeAlignment === "center",
        "ml-[100%] -translate-x-full": nodeAlignment === "right",
      })}
    >
      <div
        ref={containerRef}
        className="group/image-component relative inline-block max-w-full"
        // Pointer-only: selects the image node; keyboard selection goes through the editor.
        role="presentation"
        onMouseDown={handleImageMouseDown}
        style={{
          width: size.width,
          ...(size.aspectRatio && { aspectRatio: size.aspectRatio }),
        }}
      >
        {showImageLoader && (
          <div className="animate-pulse rounded-md bg-layer-1" style={{ width: size.width, height: size.height }} />
        )}
        <img
          ref={imageRef}
          src={displayedImageSrc}
          alt=""
          onLoad={handleImageLoad}
          onError={handleImageError}
          width={size.width}
          className={cn("image-component block rounded-md", {
            // hide the image while the background calculations of the image loader are in progress (to avoid flickering) and show the loader until then
            hidden: showImageLoader,
            "read-only-image": !editor.isEditable,
            "loading-image opacity-80 blur-sm": !resolvedImageSrc,
          })}
          style={{
            width: size.width,
            ...(size.aspectRatio && { aspectRatio: size.aspectRatio }),
          }}
        />
        {showUploadStatus && node.attrs[ECustomImageAttributeNames.ID] && (
          <ImageUploadStatus editor={editor} nodeId={node.attrs[ECustomImageAttributeNames.ID]} />
        )}
        {toolbarSources && (
          <ImageToolbarRoot
            alignment={nodeAlignment ?? "left"}
            editor={editor}
            aspectRatio={size.aspectRatio === null ? 1 : size.aspectRatio}
            downloadSrc={toolbarSources.downloadSrc}
            handleAlignmentChange={(alignment) =>
              updateAttributesSafely({ alignment }, "Failed to update attributes while changing alignment:")
            }
            height={size.height}
            isTouchDevice={isTouchDevice}
            width={size.width}
            src={toolbarSources.src}
          />
        )}
        {selected && displayedImageSrc === resolvedImageSrc && (
          <div className="pointer-events-none absolute inset-0 size-full bg-accent-primary/30" />
        )}
        {showImageResizer && (
          <ImageResizeHandles alignment={nodeAlignment} isResizing={isResizing} onResizeStart={handleResizeStart} />
        )}
      </div>
    </div>
  );
}
