/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, useEffect, useMemo, useId } from "react";
import type { ReactNode } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { useDropzone } from "react-dropzone";
import useSWR from "swr";
import { Popover } from "@plane/propel/popover";
import { ACCEPTED_COVER_IMAGE_MIME_TYPES_FOR_REACT_DROPZONE, MAX_FILE_SIZE } from "@plane/constants";
import { Tabs } from "@plane/propel/tabs";
import { Button, getButtonStyling } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { EFileAssetType } from "@plane/types";
import { Input, Loader } from "@plane/ui";
import { STATIC_COVER_IMAGES, getCoverImageDisplayURL } from "@/helpers/cover-image.helper";
import { useInstance } from "@/hooks/store/use-instance";
import { FileService } from "@/services/file.service";

type ViewProps = {
  label: ReactNode;
  value: string | null;
  currentImage?: ReactNode;
  onSelect: (url: string) => Promise<void>;
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
  tabIndex?: number;
  unsplash?: {
    images: Awaited<ReturnType<FileService["getUnsplashImages"]>> | undefined;
    error: boolean;
    onSearch: (query: string) => void;
  };
};

// This adapter remains while registered project routes use the Django asset owner.
export const ImagePickerPopover = observer(function ImagePickerPopover({
  onChange,
  isProfileCover = false,
  projectId,
  value,
  ...props
}: Omit<ViewProps, "onSelect" | "onUpload" | "unsplash"> & {
  onChange: (url: string) => void;
  isProfileCover?: boolean;
  projectId?: string | null;
}) {
  const fileService = useMemo(() => new FileService(), []);
  const { workspaceSlug } = useParams();
  const { config } = useInstance();
  const [query, setQuery] = useState("");
  const { data: images, error } = useSWR(
    config?.has_unsplash_configured ? `UNSPLASH_IMAGES_${query}` : null,
    () => fileService.getUnsplashImages(query),
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  return (
    <ImagePickerPopoverView
      {...props}
      value={getCoverImageDisplayURL(value, null)}
      onSelect={async (url) => onChange(url)}
      onUpload={async (file) => {
        if (isProfileCover) {
          const result = await fileService.uploadUserAsset(
            { entity_identifier: "", entity_type: EFileAssetType.USER_COVER },
            file
          );
          onChange(result.asset_url);
        } else {
          if (!workspaceSlug) throw new Error("Choose a workspace before uploading a project cover.");
          const result = await fileService.uploadWorkspaceAsset(
            workspaceSlug.toString(),
            { entity_identifier: projectId ?? "", entity_type: EFileAssetType.PROJECT_COVER },
            file
          );
          onChange(result.asset_url);
        }
      }}
      unsplash={config?.has_unsplash_configured ? { images, error: Boolean(error), onSearch: setQuery } : undefined}
    />
  );
});

export function ImagePickerPopoverView({
  label,
  value,
  currentImage,
  onSelect,
  onUpload,
  disabled = false,
  tabIndex,
  unsplash,
}: ViewProps) {
  const triggerId = useId();
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    if (!image) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop: (files) => setImage(files[0] ?? null),
    accept: ACCEPTED_COVER_IMAGE_MIME_TYPES_FOR_REACT_DROPZONE,
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    disabled: pending || disabled,
  });

  const chooseImage = async (operation: () => Promise<void>) => {
    setPending(true);
    try {
      await operation();
      setImage(null);
      setIsOpen(false);
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Image selection failed",
        message: error instanceof Error ? error.message : "The image could not be selected. Please try again.",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="relative z-19" tabIndex={tabIndex}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <Popover.Button id={triggerId} className={getButtonStyling("secondary", "sm")} disabled={disabled || pending}>
          {label}
        </Popover.Button>
        <Popover.Panel
          aria-labelledby={triggerId}
          className="z-20 rounded-md border border-subtle bg-surface-1 shadow-raised-200"
          positionerClassName="z-110"
          placement="bottom-start"
        >
          <div className="flex h-96 w-80 flex-col overflow-auto rounded border border-subtle bg-surface-1 shadow-raised-200 md:h-[36rem] md:w-[36rem]">
            <Tabs defaultValue={unsplash ? "unsplash" : "images"} className="flex h-full flex-col p-3">
              <Tabs.List className="flex rounded bg-layer-3 p-1">
                {unsplash && (
                  <Tabs.Trigger value="unsplash" size="md">
                    Unsplash
                  </Tabs.Trigger>
                )}
                <Tabs.Trigger value="images" size="md">
                  Images
                </Tabs.Trigger>
                <Tabs.Trigger value="upload" size="md">
                  Upload
                </Tabs.Trigger>
                <Tabs.Indicator />
              </Tabs.List>
              <div className="vertical-scrollbar mt-3 scrollbar-sm flex-1 overflow-x-hidden overflow-y-auto p-3">
                {unsplash && (
                  <Tabs.Content value="unsplash" className="h-full w-full space-y-4">
                    <UnsplashImageSearch
                      unsplash={unsplash}
                      pending={pending}
                      onSelect={(url) => void chooseImage(() => onSelect(url))}
                    />
                  </Tabs.Content>
                )}
                <Tabs.Content value="images" className="h-full w-full space-y-4">
                  <div className="grid grid-cols-4 gap-4">
                    {Object.values(STATIC_COVER_IMAGES).map((imageUrl, index) => (
                      <button
                        key={imageUrl}
                        type="button"
                        disabled={pending}
                        className="relative col-span-2 aspect-video md:col-span-1"
                        onClick={() => void chooseImage(() => onSelect(imageUrl))}
                      >
                        <img
                          src={imageUrl}
                          alt={`Cover ${index + 1}`}
                          className="absolute top-0 left-0 h-full w-full cursor-pointer rounded-sm object-cover transition-opacity hover:opacity-80"
                        />
                      </button>
                    ))}
                  </div>
                </Tabs.Content>
                <Tabs.Content value="upload" className="h-full w-full">
                  <div className="flex h-full w-full flex-col gap-y-2">
                    <div className="flex w-full flex-1 items-center gap-3">
                      <div
                        {...getRootProps()}
                        className={`relative grid h-full w-full cursor-pointer place-items-center rounded-lg p-12 text-center focus:ring-2 focus:ring-accent-strong focus:ring-offset-2 focus:outline-none ${
                          (!image && isDragActive) || (!value && !currentImage)
                            ? "border-2 border-dashed border-subtle hover:bg-surface-2"
                            : ""
                        }`}
                      >
                        <button
                          type="button"
                          className="absolute top-0 right-0 z-40 -translate-y-1/2 rounded-sm bg-surface-2 px-2 py-0.5 text-11 font-medium text-secondary"
                        >
                          Edit
                        </button>
                        {preview ? (
                          <img src={preview} alt="Selected cover" className="h-full w-full rounded-lg object-cover" />
                        ) : currentImage ? (
                          currentImage
                        ) : value ? (
                          <img src={value} alt="Current cover" className="h-full w-full rounded-lg object-cover" />
                        ) : (
                          <span className="mt-2 block text-13 font-medium text-secondary">
                            {isDragActive ? "Drop image here to upload" : "Drag & drop image here"}
                          </span>
                        )}
                        <input {...getInputProps()} />
                      </div>
                    </div>
                    {fileRejections.length > 0 && (
                      <p role="alert" className="text-13 text-danger-primary">
                        {fileRejections[0].errors[0].code === "file-too-large"
                          ? "The image size cannot exceed 5 MB."
                          : "Please upload a file in a valid format."}
                      </p>
                    )}
                    <p className="text-13 text-secondary">File formats supported- .jpeg, .jpg, .png, .webp</p>
                    <div className="flex h-12 items-start justify-end gap-2">
                      <Button
                        variant="secondary"
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          setIsOpen(false);
                          setImage(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        type="button"
                        className="w-full"
                        onClick={() => image && void chooseImage(() => onUpload(image))}
                        disabled={!image || pending}
                        loading={pending}
                      >
                        {pending ? "Uploading" : "Use image"}
                      </Button>
                    </div>
                  </div>
                </Tabs.Content>
              </div>
            </Tabs>
          </div>
        </Popover.Panel>
      </Popover>
    </div>
  );
}

function UnsplashImageSearch({
  unsplash,
  pending,
  onSelect,
}: {
  unsplash: NonNullable<ViewProps["unsplash"]>;
  pending: boolean;
  onSelect: (url: string) => void;
}) {
  const [search, setSearch] = useState("");
  return (
    <>
      <div className="flex items-center gap-x-2">
        <Input
          name="cover-image-search"
          aria-label="Search for cover images"
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              unsplash.onSearch(search);
            }
          }}
          placeholder="Search for images"
          className="w-full text-13"
        />
        <Button variant="primary" size="xl" type="button" onClick={() => unsplash.onSearch(search)}>
          Search
        </Button>
      </div>
      {unsplash.error ? (
        <p role="alert" className="pt-7 text-center text-11 text-danger-primary">
          Images could not be loaded. Try another search.
        </p>
      ) : unsplash.images ? (
        unsplash.images.length > 0 ? (
          <div className="grid grid-cols-4 gap-4">
            {unsplash.images.map((result) => (
              <button
                key={result.id}
                type="button"
                disabled={pending}
                className="relative col-span-2 aspect-video md:col-span-1"
                onClick={() => onSelect(result.urls.regular)}
              >
                <img
                  src={result.urls.small}
                  alt={result.alt_description}
                  className="absolute top-0 left-0 h-full w-full rounded-sm object-cover"
                />
              </button>
            ))}
          </div>
        ) : (
          <p className="pt-7 text-center text-11 text-secondary">No images found.</p>
        )
      ) : (
        <Loader className="grid grid-cols-4 gap-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Loader.Item key={index} height="80px" width="100%" />
          ))}
        </Loader>
      )}
    </>
  );
}
