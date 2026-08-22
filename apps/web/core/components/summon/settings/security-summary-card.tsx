/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { ArrowRight } from "lucide-react";
import { SECURITY_SUMMARY } from "./mock-data";

interface ISecuritySummaryCardProps {
  onManageSecurity?: () => void;
}

export const SecuritySummaryCard: React.FC<ISecuritySummaryCardProps> = ({ onManageSecurity }) => {
  return (
    <div className="shadow-xs flex flex-col rounded-xl border border-subtle bg-surface-1 p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-primary">Security</h2>
        <button
          type="button"
          onClick={onManageSecurity}
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-[11px] font-medium transition-colors"
        >
          Manage
        </button>
      </div>

      {/* Security Rows */}
      <div className="text-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-secondary">SSO Login</span>
          <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-medium">
            {SECURITY_SUMMARY.ssoLogin ? "Enabled" : "Disabled"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-secondary">MFA</span>
          <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-medium">
            {SECURITY_SUMMARY.mfa ? "Enabled" : "Disabled"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-secondary">Session Timeout</span>
          <span className="text-[11px] font-medium text-primary">{SECURITY_SUMMARY.sessionTimeoutMinutes} minutes</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-secondary">Password Policy</span>
          <span className="text-[11px] font-medium text-primary">{SECURITY_SUMMARY.passwordPolicy}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-secondary">Last Security Check</span>
          <span className="text-[11px] font-medium text-secondary">{SECURITY_SUMMARY.lastSecurityCheck}</span>
        </div>
      </div>

      {/* Link */}
      <button
        type="button"
        onClick={onManageSecurity}
        className="hover:text-blue-600 mt-3.5 flex items-center justify-between border-t border-subtle pt-2.5 text-[11px] font-medium text-secondary transition-colors"
      >
        <span>View security settings</span>
        <ArrowRight size={12} />
      </button>
    </div>
  );
};
