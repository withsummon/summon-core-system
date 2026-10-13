/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { FileText, GitBranch, Globe, HardDrive, Video, Key } from "lucide-react";
import type { ISummonResourceLink } from "@plane/types";
import { RESOURCE_KIND_TONE } from "./types";

interface ICategoryCardsRowProps {
  resources: ISummonResourceLink[];
  credentialCount: number;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export function CategoryCardsRow({
  resources,
  credentialCount,
  selectedCategory,
  onSelectCategory,
}: ICategoryCardsRowProps) {
  // Compute dynamic counts from live DB records
  const docCount = resources.filter(
    (r) =>
      r.category === "document" ||
      r.category === "page" ||
      r.title.endsWith(".pdf") ||
      r.title.endsWith(".docx") ||
      r.title.endsWith(".xlsx")
  ).length;

  const repoCount = resources.filter(
    (r) => r.category === "repository" || r.url.includes("github.com") || r.url.includes("gitlab.com")
  ).length;

  const figmaCount = resources.filter((r) => r.category === "figma" || r.url.includes("figma.com")).length;

  const deploymentCount = resources.filter(
    (r) => r.category === "deployment" || r.url.includes("withsummon.com") || r.url.includes(".app")
  ).length;

  const driveCount = resources.filter((r) => r.category === "drive" || r.url.includes("drive.google.com")).length;

  const recordingCount = resources.filter(
    (r) => r.category === "recording" || r.title.endsWith(".mp4") || r.title.endsWith(".mov")
  ).length;

  const categories = [
    {
      id: "document",
      label: "Documents",
      count: docCount,
      icon: <FileText className="size-5" />,
      tone: RESOURCE_KIND_TONE.document.tile,
    },
    {
      id: "repository",
      label: "Repositories",
      count: repoCount,
      icon: <GitBranch className="size-5" />,
      tone: RESOURCE_KIND_TONE.repository.tile,
    },
    {
      id: "figma",
      label: "Figma Files",
      count: figmaCount,
      icon: (
        <svg className="size-5" viewBox="0 0 38 57" fill="currentColor">
          <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" fill="#1ABCFE" />
          <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" fill="#0ACF83" />
          <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" fill="#FF7262" />
          <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" fill="#F24E1E" />
          <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" fill="#A259FF" />
        </svg>
      ),
      tone: RESOURCE_KIND_TONE.figma.tile,
    },
    {
      id: "deployment",
      label: "Deployments",
      count: deploymentCount,
      icon: <Globe className="size-5" />,
      tone: RESOURCE_KIND_TONE.deployment.tile,
    },
    {
      id: "drive",
      label: "Google Drive",
      count: driveCount,
      icon: <HardDrive className="size-5" />,
      tone: RESOURCE_KIND_TONE.drive.tile,
    },
    {
      id: "recording",
      label: "Recordings",
      count: recordingCount,
      icon: <Video className="size-5" />,
      tone: RESOURCE_KIND_TONE.recording.tile,
    },
    {
      id: "account",
      label: "Accounts",
      count: credentialCount,
      icon: <Key className="size-5" />,
      tone: RESOURCE_KIND_TONE.account.tile,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="text-12 font-medium text-tertiary">Resource categories</div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id;

          return (
            <button
              key={cat.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelectCategory(isSelected ? "all" : cat.id)}
              className={`group flex press flex-col justify-between rounded-xl border p-3.5 text-left shadow-xs transition-colors ${
                isSelected ? "border-accent-strong bg-accent-subtle" : "border-subtle bg-surface-1 hover:border-strong"
              }`}
            >
              <div className={`flex size-10 items-center justify-center rounded-lg ${cat.tone}`}>{cat.icon}</div>

              <div className="mt-3.5">
                <div className="text-13 font-medium text-primary group-hover:text-accent-primary">{cat.label}</div>
                <div className="mt-0.5 text-12 font-medium text-tertiary">
                  {cat.count} {cat.count === 1 ? "item" : "items"}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
