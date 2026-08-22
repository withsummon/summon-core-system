/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ICompanyProfileForm, IIntegrationItem, ISecuritySummary, IWorkspacePreferencesForm } from "./types";

export const INITIAL_COMPANY_PROFILE: ICompanyProfileForm = {
  companyName: "Summon Indonesia",
  workspaceUrl: "summon-core.withsummon.com",
  industry: "Technology, Information & Internet",
  companySize: "51 - 200 employees",
  description:
    "Summon is an AI-empowered business and project management platform that helps teams manage projects, clients, documents, and knowledge in one integrated workspace.",
  timeZone: "(GMT+7) Jakarta, Indonesia",
  currency: "IDR - Indonesian Rupiah",
  startOfWeek: "Monday",
  workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
};

export const INITIAL_WORKSPACE_PREFERENCES: IWorkspacePreferencesForm = {
  language: "English",
  defaultLandingPage: "Home",
  dateFormat: "20 August 2025",
  itemsPerPage: 20,
  timeFormat: "12-hour",
  theme: "light",
};

export const INTEGRATIONS_LIST: IIntegrationItem[] = [
  { id: "int-1", name: "Google Workspace", iconName: "google", connected: true },
  { id: "int-2", name: "Microsoft 365", iconName: "microsoft", connected: true },
  { id: "int-3", name: "Slack", iconName: "slack", connected: true },
  { id: "int-4", name: "GitHub", iconName: "github", connected: true },
  { id: "int-5", name: "Figma", iconName: "figma", connected: true },
];

export const SECURITY_SUMMARY: ISecuritySummary = {
  ssoLogin: true,
  mfa: true,
  sessionTimeoutMinutes: 60,
  passwordPolicy: "Strong",
  lastSecurityCheck: "2 days ago",
};

export const WORKSPACE_MEMBERS = [
  {
    id: "m-1",
    name: "Fikri Adriansyah",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
  },
  {
    id: "m-2",
    name: "Muhammad Arief",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
  },
  {
    id: "m-3",
    name: "Wibi Susanto",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
  },
  {
    id: "m-4",
    name: "Rafael Lorenzo",
    avatar: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=100&auto=format&fit=crop&q=80",
  },
  {
    id: "m-5",
    name: "Dewi Lestari",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
  },
];
