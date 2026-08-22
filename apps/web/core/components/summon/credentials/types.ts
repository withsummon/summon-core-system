/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TCredentialType = "Server" | "Cloud" | "Database" | "API Key" | "SaaS" | "Storage" | "Certificate";

export type TCredentialEnvironment = "Production" | "Staging" | "Development" | "Testing";

export type TCredentialStatus = "active" | "expiring_soon" | "revoked" | "risky";

export type TCredentialFilterTab = "All Credentials" | "By Project" | "By Type" | "Shared With Me" | "Recently Accessed";

export interface ICredentialItem {
  id: string;
  name: string;
  identifier: string;
  type: TCredentialType;
  project: string;
  environment: TCredentialEnvironment;
  lastUsed: string;
  status: TCredentialStatus;
  username: string;
  passwordMasked?: string;
  passwordRaw?: string;
  hostIp?: string;
  port?: string;
  protocol?: string;
  description?: string;
  tags: string[];
  createdBy: {
    name: string;
    avatar?: string;
    date: string;
  };
  passwordRotationPolicy?: string;
  accessSummary: {
    owner: string;
    usersWithAccess: number;
    userGroups: number;
    lastAccessedBy: {
      name: string;
      timeAgo: string;
    };
  };
}

export interface ICredentialKpi {
  totalCredentials: number;
  totalProjects: number;
  activeAccounts: number;
  activeAccountsPercentage: number;
  sharedWithMe: number;
  sharedFromProjects: number;
  expiringSoon: number;
  expiringDaysLimit: number;
  riskyCredentials: number;
}
