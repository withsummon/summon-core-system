/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { NavLink, Outlet, useParams } from "react-router";
import { SUMMON_MODULES } from "@plane/constants";
import { cn } from "@plane/utils";
import { useProject } from "@/hooks/store/use-project";

export function SummonPageShell() {
  const { workspaceSlug = "" } = useParams();
  const { joinedProjectIds } = useProject();
  const projectId = joinedProjectIds[0];
  const nativeLinks = [
    {
      label: "Tasks",
      href: projectId ? `/${workspaceSlug}/projects/${projectId}/issues` : `/${workspaceSlug}/projects`,
    },
    {
      label: "Knowledge",
      href: projectId ? `/${workspaceSlug}/projects/${projectId}/pages` : `/${workspaceSlug}/projects`,
    },
    {
      label: "Documents",
      href: projectId ? `/${workspaceSlug}/projects/${projectId}/pages` : `/${workspaceSlug}/projects`,
    },
    { label: "Notifications", href: `/${workspaceSlug}/notifications` },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="border-b border-subtle bg-surface-1 px-5 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-accent-primary uppercase">Summon Core</p>
            <p className="text-sm text-secondary">Commercial and delivery operations on Plane records</p>
          </div>
          <nav className="flex flex-wrap gap-1" aria-label="Plane records">
            {nativeLinks.map((item) => (
              <NavLink
                key={item.label}
                to={item.href}
                className="text-xs rounded px-2 py-1 text-secondary hover:bg-layer-1"
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <nav className="horizontal-scrollbar flex gap-1 overflow-x-auto" aria-label="Summon modules">
          {SUMMON_MODULES.map((module) => (
            <NavLink
              key={module.key}
              end={!module.path}
              to={`/${workspaceSlug}/summon${module.path ? `/${module.path}` : ""}`}
              className={({ isActive }) =>
                cn("text-xs border-b-2 px-2 py-2 font-medium whitespace-nowrap", {
                  "border-accent-strong text-primary": isActive,
                  "border-transparent text-secondary hover:text-primary": !isActive,
                })
              }
            >
              {module.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
