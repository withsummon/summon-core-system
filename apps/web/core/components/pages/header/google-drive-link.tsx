/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ArrowUpRight } from "lucide-react";
// plane imports
import { Tooltip } from "@plane/propel/tooltip";
// store
import type { TPageInstance } from "@/store/pages/base-page";

type Props = {
  page: TPageInstance;
};

/** A page synced from Google Drive keeps text only; the file itself has the images and layout, and takes edits. */
export function PageGoogleDriveLink({ page }: Props) {
  if (!page.googleDriveUrl) return null;

  return (
    <Tooltip tooltipContent="Synced from Google Drive. Edit it there to update this page." position="bottom">
      <a
        href={page.googleDriveUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open in Google Drive"
        className="flex h-6 flex-shrink-0 items-center gap-1 rounded-sm px-1 text-11 font-medium whitespace-nowrap text-secondary transition-colors hover:bg-layer-1 hover:text-primary sm:px-2"
      >
        {/* Phones keep the header's room for the page's own controls. */}
        <span className="hidden sm:inline">Open in Google Drive</span>
        <ArrowUpRight className="size-3.5 flex-shrink-0" />
      </a>
    </Tooltip>
  );
}
