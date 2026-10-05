/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { cn } from "@plane/utils";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
// helpers
import { getCoverImageDisplayURL, DEFAULT_COVER_IMAGE_URL } from "@/helpers/cover-image.helper";

type TCoverImageProps = {
  /** The cover image URL - can be static, uploaded, or external */
  src: string | null | undefined;
  /** Alt text for the image */
  alt?: string;
  /** Additional className for the image or skeleton */
  className?: string;
  /** Whether to show default image when src is null/undefined. If false, shows loading skeleton */
  showDefaultWhenEmpty?: boolean;
  /** Custom fallback URL to use instead of DEFAULT_COVER_IMAGE_URL */
  fallbackUrl?: string;
} & Omit<React.ComponentProps<"img">, "src">;

/**
 * A reusable cover image component that handles:
 * - Loading states with skeleton
 * - Static images (local assets)
 * - Uploaded images (processed through getFileURL)
 * - External URLs
 * - Fallback to default cover image
 */
export function CoverImage(props: TCoverImageProps) {
  const {
    src,
    alt = "Cover image",
    className,
    showDefaultWhenEmpty = false,
    fallbackUrl = DEFAULT_COVER_IMAGE_URL,
    ...restProps
  } = props;

  const photo = useQuery(api.identity.instance.image.attribution, src ? { url: src } : "skip");

  // Show loading skeleton when src is undefined/null and we don't want to show default
  if (!src && !showDefaultWhenEmpty) {
    return <div className={cn("animate-pulse bg-layer-2", className)} />;
  }

  const displayUrl = getCoverImageDisplayURL(src, fallbackUrl);

  if (!photo) return <img src={displayUrl} alt={alt} className={cn("object-cover", className)} {...restProps} />;
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <img src={displayUrl} alt={alt} className="h-full w-full object-cover" {...restProps} />
      <StockImageAttribution
        photo={photo}
        className="pointer-events-auto absolute top-1 left-1 z-[2] max-w-[calc(100%-0.5rem)] rounded bg-black/70 px-2 py-1 text-11 text-white"
      />
    </div>
  );
}

export function StockImageAttribution({
  photo,
  className,
}: {
  photo: NonNullable<FunctionReturnType<typeof api.identity.instance.image.attribution>>;
  className?: string;
}) {
  return (
    <p className={className}>
      Photo by{" "}
      <a href={photo.user.links.html} target="_blank" rel="noreferrer" className="underline">
        {photo.user.name}
      </a>
      {" on "}
      <a href={photo.links.html} target="_blank" rel="noreferrer" className="underline">
        Unsplash
      </a>
    </p>
  );
}
