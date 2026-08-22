/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TSettingsNavCategory = "SETTINGS" | "SYSTEM" | "CUSTOMIZATION";

export type TSettingsSection =
  | "general"
  | "users_teams"
  | "roles_permissions"
  | "projects_templates"
  | "clients_contacts"
  | "categories_tags"
  | "integrations"
  | "ai_settings"
  | "security"
  | "notifications"
  | "credential_policies"
  | "audit_logs"
  | "branding"
  | "document_templates"
  | "task_workflow"
  | "custom_fields";

export interface ICompanyProfileForm {
  companyName: string;
  workspaceUrl: string;
  industry: string;
  companySize: string;
  description: string;
  timeZone: string;
  currency: string;
  startOfWeek: string;
  workingDays: string[];
}

export interface IWorkspacePreferencesForm {
  language: string;
  defaultLandingPage: string;
  dateFormat: string;
  itemsPerPage: number;
  timeFormat: "12-hour" | "24-hour";
  theme: "light" | "dark" | "system";
}

export interface IIntegrationItem {
  id: string;
  name: string;
  iconName: "google" | "microsoft" | "slack" | "github" | "figma";
  connected: boolean;
}

export interface ISecuritySummary {
  ssoLogin: boolean;
  mfa: boolean;
  sessionTimeoutMinutes: number;
  passwordPolicy: string;
  lastSecurityCheck: string;
}
