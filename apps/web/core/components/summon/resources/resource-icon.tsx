/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { FileText, FileSpreadsheet, Globe, Video, Key, HardDrive, GitBranch } from "lucide-react";

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

  const extension = lowerTitle.slice(lowerTitle.lastIndexOf("."));
  const styles = [
    {
      matches: lowerCat === "pdf" || extension === ".pdf",
      Icon: FileText,
      tone: "bg-red-500/10 text-red-600 dark:text-red-400",
    },
    {
      matches: lowerCat === "spreadsheet" || [".xlsx", ".xls", ".csv"].includes(extension),
      Icon: FileSpreadsheet,
      tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      matches: lowerCat === "presentation" || [".pptx", ".ppt"].includes(extension),
      Icon: FileText,
      tone: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    },
    {
      matches: [".docx", ".doc"].includes(extension),
      Icon: FileText,
      tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
  ];
  const file = styles.find((style) => style.matches);
  if (file) {
    const Icon = file.Icon;
    return (
      <div className={`${file.tone} flex size-7 shrink-0 items-center justify-center rounded-lg`}>
        <Icon className={className} />
      </div>
    );
  }

  // 5. Figma
  if ([lowerCat === "figma", lowerUrl.includes("figma.com"), lowerTitle.includes("figma")].some(Boolean)) {
    return (
      <div className="bg-pink-500/10 text-pink-600 dark:text-pink-400 flex size-7 shrink-0 items-center justify-center rounded-lg">
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
    [
      ["repository", "repo"].includes(lowerCat),
      ["github.com", "gitlab.com"].some((host) => lowerUrl.includes(host)),
      lowerTitle.includes("git"),
    ].some(Boolean)
  ) {
    return (
      <div className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex size-7 shrink-0 items-center justify-center rounded-lg">
        <GitBranch className={className} />
      </div>
    );
  }

  // 7. Google Drive
  if (["drive", "google drive"].includes(lowerCat) || lowerUrl.includes("drive.google.com")) {
    return (
      <div className="bg-teal-500/10 text-teal-600 dark:text-teal-400 flex size-7 shrink-0 items-center justify-center rounded-lg">
        <HardDrive className={className} />
      </div>
    );
  }

  // 8. Deployment / Live Web URL
  if (["deployment", "live"].includes(lowerCat) || [".com", ".id"].some((host) => lowerUrl.includes(host))) {
    return (
      <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex size-7 shrink-0 items-center justify-center rounded-lg">
        <Globe className={className} />
      </div>
    );
  }

  // 9. Video Recording / MP4
  if (lowerCat === "recording" || [".mp4", ".mov"].includes(extension) || lowerTitle.includes("recording")) {
    return (
      <div className="bg-purple-500/10 text-purple-600 dark:text-purple-400 flex size-7 shrink-0 items-center justify-center rounded-lg">
        <Video className={className} />
      </div>
    );
  }

  // 10. Account / Credential
  if (["account", "credential", "credentials"].includes(lowerCat)) {
    return (
      <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 flex size-7 shrink-0 items-center justify-center rounded-lg">
        <Key className={className} />
      </div>
    );
  }

  // Default fallback: Document
  return (
    <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 flex size-7 shrink-0 items-center justify-center rounded-lg">
      <FileText className={className} />
    </div>
  );
}
