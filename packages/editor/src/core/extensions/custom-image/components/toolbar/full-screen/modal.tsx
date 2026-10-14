/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Download, Minus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { NewTabIcon, PlusIcon, CloseIcon } from "@plane/propel/icons";
// plane imports
import { cn } from "@plane/utils";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_SPEED = 0.05;
const ZOOM_STEPS = [0.5, 1, 1.5, 2];

type Props = {
  aspectRatio: number;
  downloadSrc: string;
  isFullScreenEnabled: boolean;
  isTouchDevice: boolean;
  src: string;
  toggleFullScreenMode: (val: boolean) => void;
  width: string;
};

function ImageFullScreenModalWithoutPortal(props: Props) {
  const { aspectRatio, isFullScreenEnabled, isTouchDevice, downloadSrc, src, toggleFullScreenMode, width } = props;
  // refs
  const dragStart = useRef({ x: 0, y: 0 });
  const dragOffset = useRef({ x: 0, y: 0 });

  const [magnification, setMagnification] = useState<number>(1);
  // mirrors `magnification` so rapid wheel/key events build on the latest value without an impure state updater
  const magnificationRef = useRef(1);
  const [initialMagnification, setInitialMagnification] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const updateMagnification = useCallback((nextMagnification: number) => {
    magnificationRef.current = nextMagnification;
    setMagnification(nextMagnification);
    // Reset position when zoom matches initial magnification
    if (nextMagnification === 1 && imgRef.current) {
      imgRef.current.style.left = "0px";
      imgRef.current.style.top = "0px";
    }
  }, []);

  const widthInNumber = useMemo(() => {
    if (!width) return 0;
    return Number(width.replace("px", ""));
  }, [width]);

  const setImageRef = useCallback(
    (node: HTMLImageElement | null) => {
      if (!node || !isFullScreenEnabled) return;

      imgRef.current = node;

      const viewportWidth = window.innerWidth * 0.9;
      const viewportHeight = window.innerHeight * 0.75;
      const imageWidth = widthInNumber;
      const imageHeight = imageWidth / aspectRatio;

      const widthRatio = viewportWidth / imageWidth;
      const heightRatio = viewportHeight / imageHeight;

      setInitialMagnification(Math.min(widthRatio, heightRatio));
      // also resets the image position
      updateMagnification(1);
    },
    [isFullScreenEnabled, widthInNumber, aspectRatio, updateMagnification]
  );

  const handleClose = useCallback(() => {
    if (isDragging) return;
    toggleFullScreenMode(false);
    updateMagnification(1);
    setInitialMagnification(1);
  }, [isDragging, toggleFullScreenMode, updateMagnification]);

  const handleMagnification = useCallback(
    (direction: "increase" | "decrease") => {
      const prev = magnificationRef.current;
      // Find the appropriate target zoom level based on current magnification
      const targetZoom =
        direction === "increase"
          ? (ZOOM_STEPS.find((step) => step > prev) ?? MAX_ZOOM)
          : // Reverse the array to find the next lower step
            ([...ZOOM_STEPS].reverse().find((step) => step < prev) ?? MIN_ZOOM);
      updateMagnification(targetZoom);
    },
    [updateMagnification]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "+" || e.key === "=" || e.key === "-") {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === "Escape") handleClose();
        if (e.key === "+" || e.key === "=") handleMagnification("increase");
        if (e.key === "-") handleMagnification("decrease");
      }
    },
    [handleClose, handleMagnification]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imgRef.current) return;

    const imgWidth = imgRef.current.offsetWidth * magnification;
    const imgHeight = imgRef.current.offsetHeight * magnification;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (imgWidth > viewportWidth || imgHeight > viewportHeight) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY };
      dragOffset.current = {
        x: parseInt(imgRef.current.style.left || "0"),
        y: parseInt(imgRef.current.style.top || "0"),
      };
    }
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !imgRef.current) return;

      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;

      // Apply the scale factor to the drag movement
      const scaledDx = dx / magnification;
      const scaledDy = dy / magnification;

      imgRef.current.style.left = `${dragOffset.current.x + scaledDx}px`;
      imgRef.current.style.top = `${dragOffset.current.y + scaledDy}px`;
    },
    [isDragging, magnification]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDragging || !imgRef.current) return;
    setIsDragging(false);
  }, [isDragging]);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!imgRef.current || !isFullScreenEnabled) return;

      e.preventDefault();

      // Handle pinch-to-zoom
      if (e.ctrlKey || e.metaKey) {
        const newZoom = magnificationRef.current * (1 - e.deltaY * ZOOM_SPEED);
        updateMagnification(Math.min(Math.max(newZoom, MIN_ZOOM), MAX_ZOOM));
        return;
      }
    },
    [isFullScreenEnabled, updateMagnification]
  );

  // Event listeners
  useEffect(() => {
    if (!isFullScreenEnabled) return;

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("wheel", handleWheel);
    };
  }, [isFullScreenEnabled, handleKeyDown, handleMouseMove, handleMouseUp, handleWheel]);

  // Open as a native modal dialog: focus is trapped inside and the rest of the page is inert.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isFullScreenEnabled || !dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [isFullScreenEnabled]);

  const handleContainerMouseDown = (e: React.MouseEvent) => {
    if (e.target === modalRef.current) handleClose();
    else if (e.target === imgRef.current) handleMouseDown(e);
  };

  if (!isFullScreenEnabled) return null;

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        "pointer-events-none fixed inset-0 z-50 m-0 size-full max-h-none max-w-none bg-black/90 p-0 opacity-0 transition-opacity",
        {
          "editor-image-full-screen-modal pointer-events-auto opacity-100": isFullScreenEnabled,
          "cursor-default": !isDragging,
          "cursor-grabbing": isDragging,
        }
      )}
      aria-label="Fullscreen image viewer"
      // Escape is handled by the document keydown listener so an active drag can block closing.
      onCancel={(e) => e.preventDefault()}
    >
      {/* Pointer-only: backdrop click closes and dragging the image pans it; the keyboard uses the controls and Escape. */}
      <div
        ref={modalRef}
        role="presentation"
        onMouseDown={handleContainerMouseDown}
        className="relative grid size-full place-items-center overflow-hidden"
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-10 right-10 grid size-8 place-items-center"
          aria-label="Close image viewer"
        >
          <CloseIcon className="size-8 text-white/60 transition-colors hover:text-white" />
        </button>
        <img
          ref={setImageRef}
          src={src}
          alt="Full screen preview"
          className="read-only-image rounded-lg"
          style={{
            width: `${widthInNumber * initialMagnification}px`,
            maxWidth: "none",
            maxHeight: "none",
            aspectRatio,
            position: "relative",
            transform: `scale(${magnification})`,
            transformOrigin: "center",
            transition: "width 0.2s ease, transform 0.2s ease",
          }}
        />
        <div className="fixed bottom-10 left-1/2 flex -translate-x-1/2 items-center justify-center gap-1 divide-x divide-subtle-1 rounded-md border border-subtle-1 bg-black py-2">
          <div className="flex items-center">
            <button
              type="button"
              onClick={(e) => {
                if (isTouchDevice) {
                  e.preventDefault();
                  e.stopPropagation();
                }
                handleMagnification("decrease");
              }}
              className="grid size-6 place-items-center text-white/60 transition-colors duration-200 hover:text-white disabled:text-white/30"
              disabled={magnification <= MIN_ZOOM}
              aria-label="Zoom out"
            >
              <Minus className="size-4" />
            </button>
            <span className="w-12 text-center text-13 text-white">{Math.round(100 * magnification)}%</span>
            <button
              type="button"
              onClick={(e) => {
                if (isTouchDevice) {
                  e.preventDefault();
                  e.stopPropagation();
                }
                handleMagnification("increase");
              }}
              className="grid size-6 place-items-center text-white/60 transition-colors duration-200 hover:text-white disabled:text-white/30"
              disabled={magnification >= MAX_ZOOM}
              aria-label="Zoom in"
            >
              <PlusIcon className="size-4" />
            </button>
          </div>
          {!isTouchDevice && (
            <button
              type="button"
              onClick={() => window.open(downloadSrc, "_blank", "noopener,noreferrer")}
              className="grid size-8 flex-shrink-0 place-items-center text-white/60 transition-colors duration-200 hover:text-white"
              aria-label="Download image"
            >
              <Download className="size-4" />
            </button>
          )}
          {!isTouchDevice && (
            <button
              type="button"
              onClick={() => window.open(src, "_blank", "noopener,noreferrer")}
              className="grid size-8 flex-shrink-0 place-items-center text-white/60 transition-colors duration-200 hover:text-white"
              aria-label="Open image in new tab"
            >
              <NewTabIcon className="size-4" />
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}

export function ImageFullScreenModal(props: Props) {
  let modal = <ImageFullScreenModalWithoutPortal {...props} />;
  const portal = document.querySelector("#editor-portal");
  if (portal) {
    modal = ReactDOM.createPortal(modal, portal);
  } else {
    console.warn("Portal element #editor-portal not found. Rendering in document.body");
    if (typeof document !== "undefined" && document.body) {
      modal = ReactDOM.createPortal(modal, document.body);
    }
  }
  return modal;
}
