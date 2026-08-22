/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { ArrowRight, Share2, Chrome, Slack, Github, Figma } from "lucide-react";
import { INTEGRATIONS_LIST } from "./mock-data";

interface IIntegrationsCardProps {
  onManageIntegrations?: () => void;
}

const getIntegrationIcon = (name: string) => {
  switch (name) {
    case "google":
      return Chrome;
    case "slack":
      return Slack;
    case "github":
      return Github;
    case "figma":
      return Figma;
    case "microsoft":
    default:
      return Share2;
  }
};

export const IntegrationsCard: React.FC<IIntegrationsCardProps> = ({
  onManageIntegrations,
}) => {
  return (
    <div className="flex flex-col rounded-xl border border-subtle bg-surface-1 p-4 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-primary">Integrations</h2>
        <button
          type="button"
          onClick={onManageIntegrations}
          className="text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
        >
          Manage
        </button>
      </div>

      {/* Integration List */}
      <div className="space-y-2.5">
        {INTEGRATIONS_LIST.map((item) => {
          const IconComp = getIntegrationIcon(item.iconName);

          return (
            <div key={item.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-5.5 items-center justify-center rounded-md bg-surface-2 text-primary">
                  <IconComp size={13} />
                </div>
                <span className="text-xs font-medium text-primary">{item.name}</span>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                <span>Connected</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Link */}
      <button
        type="button"
        onClick={onManageIntegrations}
        className="mt-3.5 flex items-center justify-between pt-2.5 border-t border-subtle text-[11px] font-medium text-secondary hover:text-blue-600 transition-colors"
      >
        <span>View all integrations</span>
        <ArrowRight size={12} />
      </button>
    </div>
  );
};
