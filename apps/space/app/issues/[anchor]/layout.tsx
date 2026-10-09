/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Outlet } from "react-router";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@summon/convex/api";
import { LogoSpinner } from "@/components/common/logo-spinner";
import { PoweredBy } from "@/components/common/powered-by";
import { IssuesNavbarRoot } from "@/components/issues/navbar";
import { PageNotFound } from "@/components/ui/not-found";
import { usePublish } from "@/hooks/store/publish";
import type { Route } from "./+types/layout";

const DEFAULT_TITLE = "Plane";
const DEFAULT_DESCRIPTION = "Made with Plane, an AI-powered work management platform with publishing capabilities.";

export async function loader({ params }: Route.LoaderArgs) {
  const url = import.meta.env.VITE_CONVEX_URL;
  if (!url) return { metadata: null };
  try {
    const publication = await new ConvexHttpClient(url).query(api.publicSharing.index.settings, {
      anchor: params.anchor,
    });
    return { metadata: publication };
  } catch {
    // Unpublished links have no public metadata; the reactive query still owns page access.
    return { metadata: null };
  }
}

// Meta function uses the loader data to generate metadata
export function meta({ loaderData }: Route.MetaArgs) {
  const metadata = loaderData?.metadata;

  const title = metadata?.project.name || DEFAULT_TITLE;
  const description = metadata?.project.description || DEFAULT_DESCRIPTION;
  const coverImage = metadata?.project.cover
    ? new URL(metadata.project.cover.downloadPath, import.meta.env.VITE_CONVEX_SITE_URL).href
    : metadata?.project.externalCoverUrl;

  const metaTags = [
    { title },
    { name: "description", content: description },
    // OpenGraph metadata
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    // Twitter metadata
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];

  // Add images if cover image exists
  if (coverImage) {
    metaTags.push(
      { property: "og:image", content: coverImage },
      { property: "og:image:width", content: "800" },
      { property: "og:image:height", content: "600" },
      { property: "og:image:alt", content: title },
      { name: "twitter:image", content: coverImage }
    );
  }

  return metaTags;
}

// Prevent loader from re-running on anchor param changes
export function shouldRevalidate({ currentParams, nextParams }: ShouldRevalidateFunctionArgs) {
  return currentParams.anchor !== nextParams.anchor;
}

function IssuesLayout(props: Route.ComponentProps) {
  const publishSettings = usePublish(props.params.anchor);
  if (!publishSettings)
    return (
      <div className="flex h-screen w-full items-center justify-center bg-surface-1">
        <LogoSpinner />
      </div>
    );
  return (
    <>
      <div className="relative flex h-screen min-h-[500px] w-screen flex-col overflow-hidden">
        <div className="relative flex h-[60px] shrink-0 items-center border-b border-subtle-1 bg-surface-1 select-none">
          <IssuesNavbarRoot publishSettings={publishSettings} />
        </div>
        <div className="relative size-full overflow-hidden bg-surface-2">
          <Outlet />
        </div>
      </div>
      <PoweredBy />
    </>
  );
}

export default IssuesLayout;

export function ErrorBoundary() {
  return <PageNotFound />;
}
