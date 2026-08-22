/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import type { ISummonResourceLink } from "@plane/types";
import { ResourceIcon } from "./resource-icon";

interface IRecentFilesCardProps {
  resources: ISummonResourceLink[];
  onSelectCategory?: (category: string) => void;
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
    if (diffDays < 30) return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  } catch {
    return "Recently";
  }
}

export function RecentFilesCard({ resources, onSelectCategory }: IRecentFilesCardProps) {
  // Filter for file-based resources or most recent resources from DB
  const recentFiles = resources.slice(0, 5);

  return (
    <div className="shadow-sm rounded-2xl border border-subtle bg-surface-1 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-primary">Recent Files</h3>
        <button
          type="button"
          onClick={() => onSelectCategory?.("document")}
          className="text-xs font-semibold text-accent-primary hover:underline"
        >
          View all
        </button>
      </div>

      <div className="mt-3 space-y-3">
        {recentFiles.length > 0 ? (
          recentFiles.map((file) => (
            <a
              key={file.id}
              href={file.url}
              target="_blank"
              rel="noreferrer"
              className="group flex items-start gap-3 rounded-xl p-1.5 transition-colors hover:bg-layer-1"
            >
              <ResourceIcon category={file.category} title={file.title} url={file.url} className="size-4" />
              <div className="min-w-0 flex-1">
                <h4 className="text-xs truncate font-semibold text-primary group-hover:text-accent-primary">
                  {file.title}
                </h4>
                <p className="mt-0.5 text-[10px] text-tertiary">{formatRelativeTime(file.updated_at)}</p>
              </div>
            </a>
          ))
        ) : (
          <div className="text-xs py-4 text-center text-tertiary">No recent files found</div>
        )}
      </div>
    </div>
  );
}
