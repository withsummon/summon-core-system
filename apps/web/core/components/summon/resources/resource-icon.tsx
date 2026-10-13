/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { FileText, FileSpreadsheet, Globe, Video, Key, Folder, HardDrive, GitBranch } from "lucide-react";
import { RESOURCE_KIND_TONE } from "./types";

interface IResourceIconProps {
  category?: string;
  title?: string;
  url?: string;
  className?: string;
}

export function ResourceIcon({ category = "", title = "", url = "", className = "size-5" }: IResourceIconProps) {
  const lowerTitle = title.toLowerCase();
  const lowerCat = category.toLowerCase();
  const lowerUrl = url.toLowerCase();

  // 1. PDF file
  if (lowerTitle.endsWith(".pdf") || lowerCat === "pdf") {
    return (
      <div className={`${RESOURCE_KIND_TONE.pdf.tile} flex size-7 shrink-0 items-center justify-center rounded-lg`}>
        <FileText className={className} />
      </div>
    );
  }

  // 2. Spreadsheet / Excel / CSV
  if (
    lowerTitle.endsWith(".xlsx") ||
    lowerTitle.endsWith(".xls") ||
    lowerTitle.endsWith(".csv") ||
    lowerCat === "spreadsheet"
  ) {
    return (
      <div
        className={`${RESOURCE_KIND_TONE.spreadsheet.tile} flex size-7 shrink-0 items-center justify-center rounded-lg`}
      >
        <FileSpreadsheet className={className} />
      </div>
    );
  }

  // 3. Presentation / PPTX
  if (lowerTitle.endsWith(".pptx") || lowerTitle.endsWith(".ppt") || lowerCat === "presentation") {
    return (
      <div
        className={`${RESOURCE_KIND_TONE.presentation.tile} flex size-7 shrink-0 items-center justify-center rounded-lg`}
      >
        <FileText className={className} />
      </div>
    );
  }

  // 4. Word / DOCX
  if (lowerTitle.endsWith(".docx") || lowerTitle.endsWith(".doc")) {
    return (
      <div
        className={`${RESOURCE_KIND_TONE.document.tile} flex size-7 shrink-0 items-center justify-center rounded-lg`}
      >
        <FileText className={className} />
      </div>
    );
  }

  // 5. Figma
  if (lowerCat === "figma" || lowerUrl.includes("figma.com") || lowerTitle.includes("figma")) {
    return (
      <div className={`${RESOURCE_KIND_TONE.figma.tile} flex size-7 shrink-0 items-center justify-center rounded-lg`}>
        <svg className={className} viewBox="0 0 38 57" fill="currentColor">
          <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" fill="#1ABCFE" />
          <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" fill="#0ACF83" />
          <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" fill="#FF7262" />
          <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" fill="#F24E1E" />
          <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" fill="#A259FF" />
        </svg>
      </div>
    );
  }

  // 6. Repository / GitHub / GitLab
  if (
    lowerCat === "repository" ||
    lowerCat === "repo" ||
    lowerUrl.includes("github.com") ||
    lowerUrl.includes("gitlab.com") ||
    lowerTitle.includes("git")
  ) {
    return (
      <div
        className={`${RESOURCE_KIND_TONE.repository.tile} flex size-7 shrink-0 items-center justify-center rounded-lg`}
      >
        <GitBranch className={className} />
      </div>
    );
  }

  // 7. Google Drive
  if (lowerCat === "drive" || lowerCat === "google drive" || lowerUrl.includes("drive.google.com")) {
    return (
      <div className={`${RESOURCE_KIND_TONE.drive.tile} flex size-7 shrink-0 items-center justify-center rounded-lg`}>
        <HardDrive className={className} />
      </div>
    );
  }

  // 8. Deployment / Live Web URL
  if (lowerCat === "deployment" || lowerCat === "live" || lowerUrl.includes(".com") || lowerUrl.includes(".id")) {
    return (
      <div
        className={`${RESOURCE_KIND_TONE.deployment.tile} flex size-7 shrink-0 items-center justify-center rounded-lg`}
      >
        <Globe className={className} />
      </div>
    );
  }

  // 9. Video Recording / MP4
  if (
    lowerCat === "recording" ||
    lowerTitle.endsWith(".mp4") ||
    lowerTitle.endsWith(".mov") ||
    lowerTitle.includes("recording")
  ) {
    return (
      <div
        className={`${RESOURCE_KIND_TONE.recording.tile} flex size-7 shrink-0 items-center justify-center rounded-lg`}
      >
        <Video className={className} />
      </div>
    );
  }

  // 10. Account / Credential
  if (lowerCat === "account" || lowerCat === "credential" || lowerCat === "credentials") {
    return (
      <div className={`${RESOURCE_KIND_TONE.account.tile} flex size-7 shrink-0 items-center justify-center rounded-lg`}>
        <Key className={className} />
      </div>
    );
  }

  // Default fallback: Document
  return (
    <div className={`${RESOURCE_KIND_TONE.document.tile} flex size-7 shrink-0 items-center justify-center rounded-lg`}>
      <FileText className={className} />
    </div>
  );
}
