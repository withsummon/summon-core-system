/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { Check, ExternalLink } from "lucide-react";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";

export const PlanCard: React.FC = () => {
  const features = [
    "Unlimited projects",
    "Advanced AI (Summon Assistant)",
    "Unlimited storage",
    "SAML SSO & Advanced security",
    "Priority support",
  ];

  const handleManagePlan = () => {
    setToast({
      type: TOAST_TYPE.INFO,
      title: "Subscription Management",
      message: "Opening Enterprise billing portal.",
    });
  };

  return (
    <div className="flex flex-col rounded-xl border border-subtle bg-surface-1 p-4 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold text-primary">Your Plan</h2>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-400">
          Enterprise
        </span>
      </div>

      <p className="text-[11px] leading-relaxed text-secondary">
        Advanced features for large teams and mission-critical projects.
      </p>

      {/* Feature List */}
      <div className="mt-3 space-y-1.5 border-t border-subtle pt-3">
        {features.map((feat) => (
          <div key={feat} className="flex items-center gap-2 text-xs text-primary">
            <Check size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-[11px]">{feat}</span>
          </div>
        ))}
      </div>

      {/* Manage Button */}
      <button
        type="button"
        onClick={handleManagePlan}
        className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-subtle bg-surface-1 py-1.5 text-xs font-medium text-primary hover:bg-surface-2 transition-colors shadow-2xs"
      >
        <span>Manage Plan</span>
        <ExternalLink size={12} className="text-secondary" />
      </button>
    </div>
  );
};
