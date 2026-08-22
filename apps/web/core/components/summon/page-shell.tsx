/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import {
  Bell,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  ChevronLeft,
  FileText,
  FolderKanban,
  Gauge,
  KeyRound,
  Menu,
  PanelLeftClose,
  Search,
  Settings,
  Sparkles,
  UsersRound,
  WandSparkles,
  X,
} from "lucide-react";
import { observer } from "mobx-react";
import { Link, Outlet, useLocation, useParams } from "react-router";
import { cn } from "@plane/utils";
import { useUser, useUserProfile } from "@/hooks/store/user";
import { SummonThemeToggle } from "./theme-toggle";

const NAV_ITEMS = [
  ["Home", "", Gauge],
  ["Projects", "/projects/", FolderKanban],
  ["Opportunities", "/summon/opportunities", BriefcaseBusiness],
  ["Clients", "/summon/clients", UsersRound],
  ["Tasks", "/workspace-views/all-issues/", FileText],
  ["Resources", "/summon/resources", FileText],
  ["Meetings", "/summon/meetings", CalendarDays],
  ["Automation", "/summon/automation", WandSparkles],
  ["Credentials", "/summon/credentials", KeyRound],
  ["Reports", "/summon/reports", Gauge],
  ["Settings", "/summon/settings", Settings],
] as const;

export const SummonPageShell = observer(function SummonPageShell() {
  const { workspaceSlug = "" } = useParams();
  const { pathname } = useLocation();
  const { data: user } = useUser();
  const { updateUserTheme } = useUserProfile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const name =
    user?.display_name || [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email || "User";
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const sidebar = (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-subtle bg-surface-1 transition-[width]",
        collapsed ? "w-[76px]" : "w-[236px]"
      )}
    >
      <div className="flex h-16 items-center justify-between px-4">
        <Link to={`/${workspaceSlug}/summon`} className="flex min-w-0 items-center gap-2.5 text-primary">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-accent-primary text-on-color">
            <Sparkles className="size-4" />
          </span>
          {!collapsed && <span className="text-sm font-bold tracking-[0.14em]">SUMMON</span>}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="text-tertiary hover:text-primary"
            aria-label="Collapse navigation"
          >
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>
      {collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="mx-auto mb-2 text-tertiary hover:text-primary"
          aria-label="Expand navigation"
        >
          <ChevronLeft className="size-4 rotate-180" />
        </button>
      )}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {NAV_ITEMS.map(([label, suffix, Icon]) => {
          const href = suffix.startsWith("/summon")
            ? `/${workspaceSlug}${suffix}`
            : suffix
              ? `/${workspaceSlug}${suffix}`
              : `/${workspaceSlug}/summon`;
          const active =
            suffix === "" ? pathname === href || pathname === `${href}/` : pathname.startsWith(href.replace(/\/$/, ""));
          return (
            <Link
              key={label}
              to={href}
              title={collapsed ? label : undefined}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "text-xs flex h-9 items-center gap-3 rounded-xl px-3 font-medium transition-colors",
                active ? "bg-accent-subtle text-accent-primary" : "text-secondary hover:bg-layer-1 hover:text-primary",
                collapsed && "justify-center px-0"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>
      {!collapsed && (
        <Link
          to={`/${workspaceSlug}/summon/assistant`}
          className="m-3 rounded-2xl border border-accent-subtle bg-accent-subtle/40 p-3 text-primary"
        >
          <span className="text-xs flex items-center gap-2 font-semibold">
            <Bot className="size-4 text-accent-primary" />
            Summon Assistant
          </span>
          <span className="mt-1 block text-[10px] text-secondary">AI ready to help</span>
        </Link>
      )}
      <div className="flex items-center gap-2 border-t border-subtle p-3">
        <span className="text-xs grid size-9 shrink-0 place-items-center rounded-full bg-accent-primary font-semibold text-on-color">
          {initials}
        </span>
        {!collapsed && <span className="text-xs min-w-0 flex-1 truncate font-medium text-primary">{name}</span>}
      </div>
    </aside>
  );

  return (
    <div className="relative flex size-full overflow-hidden bg-surface-2">
      <div className="hidden h-full md:block">{sidebar}</div>
      {mobileOpen && (
        <div className="absolute inset-0 z-50 flex md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative h-full">{sidebar}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-subtle bg-surface-1 px-4">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="grid size-9 place-items-center rounded-xl border border-subtle md:hidden"
            aria-label="Open navigation"
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
          <button
            type="button"
            className="text-xs flex h-9 max-w-xl min-w-0 flex-1 items-center gap-2 rounded-xl border border-subtle bg-layer-1 px-3 text-left text-tertiary"
          >
            <Search className="size-4" />
            <span className="truncate">Search projects, tasks, people...</span>
            <kbd className="ml-auto hidden text-[10px] sm:block">⌘ K</kbd>
          </button>
          <Link
            to={`/${workspaceSlug}/notifications/`}
            className="grid size-9 shrink-0 place-items-center rounded-xl border border-subtle bg-surface-1 text-secondary hover:bg-layer-1"
            aria-label="Notifications"
          >
            <Bell className="size-4" />
          </Link>
          <SummonThemeToggle onChange={(theme) => updateUserTheme({ theme })} />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
});
