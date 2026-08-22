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

export const SecuritySummaryCard: React.FC<ISecuritySummaryCardProps> = ({
  onManageSecurity,
}) => {
  return (
    <div className="flex flex-col rounded-xl border border-subtle bg-surface-1 p-4 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-primary">Security</h2>
        <button
          type="button"
          onClick={onManageSecurity}
          className="text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
        >
          Manage
        </button>
      </div>

      {/* Security Rows */}
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-secondary text-[11px]">SSO Login</span>
          <span className="font-medium text-emerald-600 dark:text-emerald-400 text-[11px]">
            {SECURITY_SUMMARY.ssoLogin ? "Enabled" : "Disabled"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-secondary text-[11px]">MFA</span>
          <span className="font-medium text-emerald-600 dark:text-emerald-400 text-[11px]">
            {SECURITY_SUMMARY.mfa ? "Enabled" : "Disabled"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-secondary text-[11px]">Session Timeout</span>
          <span className="font-medium text-primary text-[11px]">
            {SECURITY_SUMMARY.sessionTimeoutMinutes} minutes
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-secondary text-[11px]">Password Policy</span>
          <span className="font-medium text-primary text-[11px]">
            {SECURITY_SUMMARY.passwordPolicy}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-secondary text-[11px]">Last Security Check</span>
          <span className="font-medium text-secondary text-[11px]">
            {SECURITY_SUMMARY.lastSecurityCheck}
          </span>
        </div>
      </div>

      {/* Link */}
      <button
        type="button"
        onClick={onManageSecurity}
        className="mt-3.5 flex items-center justify-between pt-2.5 border-t border-subtle text-[11px] font-medium text-secondary hover:text-blue-600 transition-colors"
      >
        <span>View security settings</span>
        <ArrowRight size={12} />
      </button>
    </div>
  );
};
