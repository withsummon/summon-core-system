/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import Link from "next/link";
import { FileText, GitBranch, Globe, Video, Key, ChevronRight } from "lucide-react";

interface IQuickAccessCardProps {
  workspaceSlug?: string;
  onSelectCategory: (category: string) => void;
}

export function QuickAccessCard({ workspaceSlug, onSelectCategory }: IQuickAccessCardProps) {
  const credentialsHref = workspaceSlug ? `/${workspaceSlug}/summon/credentials` : "/summon/credentials";

  const quickLinks = [
    {
      label: "All Documents",
      category: "document",
      icon: <FileText className="text-blue-500 size-4" />,
      bg: "bg-blue-500/10",
    },
    {
      label: "All Repositories",
      category: "repository",
      icon: <GitBranch className="text-indigo-500 size-4" />,
      bg: "bg-indigo-500/10",
    },
    {
      label: "All Deployments",
      category: "deployment",
      icon: <Globe className="text-emerald-500 size-4" />,
      bg: "bg-emerald-500/10",
    },
    {
      label: "All Figma Files",
      category: "figma",
      icon: (
        <svg className="size-4" viewBox="0 0 38 57" fill="currentColor">
          <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" fill="#1ABCFE" />
          <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" fill="#0ACF83" />
          <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" fill="#FF7262" />
          <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" fill="#F24E1E" />
          <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" fill="#A259FF" />
        </svg>
      ),
      bg: "bg-pink-500/10",
    },
    {
      label: "All Recordings",
      category: "recording",
      icon: <Video className="text-purple-500 size-4" />,
      bg: "bg-purple-500/10",
    },
    {
      label: "All Credentials",
      category: "account",
      href: credentialsHref,
      icon: <Key className="text-amber-500 size-4" />,
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <div className="shadow-sm rounded-2xl border border-subtle bg-surface-1 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-primary">Quick Access</h3>
        <button
          type="button"
          onClick={() => onSelectCategory("all")}
          className="text-xs font-semibold text-accent-primary hover:underline"
        >
          Manage
        </button>
      </div>

      <div className="mt-3 divide-y divide-subtle">
        {quickLinks.map((link) => {
          const content = (
            <div className="text-xs flex items-center justify-between py-2.5 transition-colors hover:text-accent-primary">
              <div className="flex items-center gap-2.5">
                <div className={`flex size-7 items-center justify-center rounded-lg ${link.bg}`}>{link.icon}</div>
                <span className="font-medium text-primary">{link.label}</span>
              </div>
              <ChevronRight className="size-3.5 text-tertiary" />
            </div>
          );

          if (link.href) {
            return (
              <Link key={link.label} href={link.href}>
                {content}
              </Link>
            );
          }

          return (
            <button
              key={link.label}
              type="button"
              onClick={() => onSelectCategory(link.category)}
              className="w-full text-left"
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
}
