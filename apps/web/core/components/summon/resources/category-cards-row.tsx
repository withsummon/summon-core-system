/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { FileText, GitBranch, Globe, HardDrive, Video, Key } from "lucide-react";
import type { ISummonResourceLink } from "@plane/types";

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
      icon: <FileText className="text-blue-500 size-5" />,
      bg: "bg-blue-500/10",
      activeBorder: "border-blue-500",
    },
    {
      id: "repository",
      label: "Repositories",
      count: repoCount,
      icon: <GitBranch className="text-indigo-500 size-5" />,
      bg: "bg-indigo-500/10",
      activeBorder: "border-indigo-500",
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
      bg: "bg-pink-500/10",
      activeBorder: "border-pink-500",
    },
    {
      id: "deployment",
      label: "Deployments",
      count: deploymentCount,
      icon: <Globe className="text-emerald-500 size-5" />,
      bg: "bg-emerald-500/10",
      activeBorder: "border-emerald-500",
    },
    {
      id: "drive",
      label: "Google Drive",
      count: driveCount,
      icon: <HardDrive className="text-teal-500 size-5" />,
      bg: "bg-teal-500/10",
      activeBorder: "border-teal-500",
    },
    {
      id: "recording",
      label: "Recordings",
      count: recordingCount,
      icon: <Video className="text-purple-500 size-5" />,
      bg: "bg-purple-500/10",
      activeBorder: "border-purple-500",
    },
    {
      id: "account",
      label: "Accounts",
      count: credentialCount,
      icon: <Key className="text-amber-500 size-5" />,
      bg: "bg-amber-500/10",
      activeBorder: "border-amber-500",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="text-xs tracking-wider font-semibold text-secondary uppercase">Resource Categories</div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(isSelected ? "all" : cat.id)}
              className={`group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all ${
                isSelected
                  ? `border-accent-primary shadow-sm ring-accent-primary bg-surface-1 ring-1`
                  : "hover:border-accent-primary/40 hover:shadow-sm border-subtle bg-surface-1"
              }`}
            >
              <div className={`flex size-10 items-center justify-center rounded-xl ${cat.bg}`}>{cat.icon}</div>

              <div className="mt-3.5">
                <div className="text-xs font-bold text-primary group-hover:text-accent-primary">{cat.label}</div>
                <div className="mt-0.5 text-[11px] font-medium text-tertiary">
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
