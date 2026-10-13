/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { FileText, FileSpreadsheet, Globe, Video, Key, HardDrive, GitBranch } from "lucide-react";
import { RESOURCE_KIND_TONE } from "./types";
import type { TResourceKind } from "./types";

interface IResourceIconProps {
  category?: string;
  title?: string;
  url?: string;
  className?: string;
}

type TIconRule = {
  kind: TResourceKind;
  matches: (title: string, category: string, url: string) => boolean;
  render: (className: string) => React.ReactNode;
};

const endsWithAny = (value: string, suffixes: string[]) => suffixes.some((suffix) => value.endsWith(suffix));

function FigmaGlyph({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 38 57" fill="currentColor">
      <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" fill="#1ABCFE" />
      <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" fill="#0ACF83" />
      <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" fill="#FF7262" />
      <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" fill="#F24E1E" />
      <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" fill="#A259FF" />
    </svg>
  );
}

// Checked in order; the first match wins.
const ICON_RULES: TIconRule[] = [
  {
    kind: "pdf",
    matches: (title, cat) => title.endsWith(".pdf") || cat === "pdf",
    render: (className) => <FileText className={className} />,
  },
  {
    kind: "spreadsheet",
    matches: (title, cat) => endsWithAny(title, [".xlsx", ".xls", ".csv"]) || cat === "spreadsheet",
    render: (className) => <FileSpreadsheet className={className} />,
  },
  {
    kind: "presentation",
    matches: (title, cat) => endsWithAny(title, [".pptx", ".ppt"]) || cat === "presentation",
    render: (className) => <FileText className={className} />,
  },
  {
    kind: "document",
    matches: (title) => endsWithAny(title, [".docx", ".doc"]),
    render: (className) => <FileText className={className} />,
  },
  {
    kind: "figma",
    matches: (title, cat, url) => cat === "figma" || url.includes("figma.com") || title.includes("figma"),
    render: (className) => <FigmaGlyph className={className} />,
  },
  {
    kind: "repository",
    matches: (title, cat, url) =>
      cat === "repository" ||
      cat === "repo" ||
      url.includes("github.com") ||
      url.includes("gitlab.com") ||
      title.includes("git"),
    render: (className) => <GitBranch className={className} />,
  },
  {
    kind: "drive",
    matches: (_title, cat, url) => cat === "drive" || cat === "google drive" || url.includes("drive.google.com"),
    render: (className) => <HardDrive className={className} />,
  },
  {
    kind: "deployment",
    matches: (_title, cat, url) =>
      cat === "deployment" || cat === "live" || url.includes(".com") || url.includes(".id"),
    render: (className) => <Globe className={className} />,
  },
  {
    kind: "recording",
    matches: (title, cat) => cat === "recording" || endsWithAny(title, [".mp4", ".mov"]) || title.includes("recording"),
    render: (className) => <Video className={className} />,
  },
  {
    kind: "account",
    matches: (_title, cat) => cat === "account" || cat === "credential" || cat === "credentials",
    render: (className) => <Key className={className} />,
  },
];

export function ResourceIcon({ category = "", title = "", url = "", className = "size-5" }: IResourceIconProps) {
  const lowerTitle = title.toLowerCase();
  const lowerCat = category.toLowerCase();
  const lowerUrl = url.toLowerCase();
  const rule = ICON_RULES.find((candidate) => candidate.matches(lowerTitle, lowerCat, lowerUrl));
  const kind = rule?.kind ?? "document";

  return (
    <div className={`${RESOURCE_KIND_TONE[kind].tile} flex size-7 shrink-0 items-center justify-center rounded-lg`}>
      {rule ? rule.render(className) : <FileText className={className} />}
    </div>
  );
}
