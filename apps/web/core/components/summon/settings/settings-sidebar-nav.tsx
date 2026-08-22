/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import {
  Settings,
  Users,
  Shield,
  FolderKanban,
  Contact,
  Tags,
  Share2,
  Sparkles,
  Lock,
  Bell,
  KeyRound,
  FileSpreadsheet,
  Palette,
  FileText,
  Workflow,
  Sliders,
} from "lucide-react";
import { cn } from "@plane/utils";
import type { TSettingsSection } from "./types";

interface ISettingsSidebarNavProps {
  activeSection: TSettingsSection;
  onSelectSection: (section: TSettingsSection) => void;
}

export const SettingsSidebarNav: React.FC<ISettingsSidebarNavProps> = ({ activeSection, onSelectSection }) => {
  const sections = [
    {
      category: "SETTINGS",
      items: [
        { id: "general" as TSettingsSection, label: "General", icon: Settings },
        { id: "users_teams" as TSettingsSection, label: "Users & Teams", icon: Users },
        { id: "roles_permissions" as TSettingsSection, label: "Roles & Permissions", icon: Shield },
        { id: "projects_templates" as TSettingsSection, label: "Projects & Templates", icon: FolderKanban },
        { id: "clients_contacts" as TSettingsSection, label: "Clients & Contacts", icon: Contact },
        { id: "categories_tags" as TSettingsSection, label: "Categories & Tags", icon: Tags },
      ],
    },
    {
      category: "SYSTEM",
      items: [
        { id: "integrations" as TSettingsSection, label: "Integrations", icon: Share2 },
        { id: "ai_settings" as TSettingsSection, label: "AI Settings", icon: Sparkles },
        { id: "security" as TSettingsSection, label: "Security", icon: Lock },
        { id: "notifications" as TSettingsSection, label: "Notifications", icon: Bell },
        { id: "credential_policies" as TSettingsSection, label: "Credential Policies", icon: KeyRound },
        { id: "audit_logs" as TSettingsSection, label: "Audit Logs", icon: FileSpreadsheet },
      ],
    },
    {
      category: "CUSTOMIZATION",
      items: [
        { id: "branding" as TSettingsSection, label: "Branding", icon: Palette },
        { id: "document_templates" as TSettingsSection, label: "Document Templates", icon: FileText },
        { id: "task_workflow" as TSettingsSection, label: "Task & Workflow", icon: Workflow },
        { id: "custom_fields" as TSettingsSection, label: "Custom Fields", icon: Sliders },
      ],
    },
  ];

  return (
    <div className="shadow-xs w-full space-y-5 rounded-xl border border-subtle bg-surface-1 p-4">
      {sections.map((group) => (
        <div key={group.category} className="space-y-1">
          <p className="tracking-wider px-2 text-[10px] font-bold text-secondary">{group.category}</p>
          <div className="mt-1.5 space-y-0.5">
            {group.items.map((item) => {
              const IconComp = item.icon;
              const isActive = activeSection === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectSection(item.id)}
                  className={cn(
                    "text-xs flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left font-medium transition-colors",
                    isActive
                      ? "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 font-semibold"
                      : "text-secondary hover:bg-surface-2 hover:text-primary"
                  )}
                >
                  <IconComp
                    size={15}
                    className={cn("shrink-0", isActive ? "text-blue-600 dark:text-blue-400" : "text-placeholder")}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
