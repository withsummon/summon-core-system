/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { Users } from "lucide-react";
import { WORKSPACE_MEMBERS } from "./mock-data";

interface IWorkspaceMembersCardProps {
  onManageMembers?: () => void;
}

export const WorkspaceMembersCard: React.FC<IWorkspaceMembersCardProps> = ({ onManageMembers }) => {
  return (
    <div className="shadow-xs flex flex-col rounded-xl border border-subtle bg-surface-1 p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-primary">Workspace Members</h2>
        <button
          type="button"
          onClick={onManageMembers}
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-[11px] font-medium transition-colors"
        >
          See all
        </button>
      </div>

      {/* Avatars Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center -space-x-2">
          {WORKSPACE_MEMBERS.map((member) => (
            <img
              key={member.id}
              src={member.avatar}
              alt={member.name}
              className="ring-surface-1 shadow-2xs size-7 rounded-full object-cover ring-2"
            />
          ))}
          <div className="ring-surface-1 flex size-7 items-center justify-center rounded-full bg-layer-2 text-[10px] font-semibold text-secondary ring-2">
            +15
          </div>
        </div>

        <button
          type="button"
          onClick={onManageMembers}
          className="text-xs shadow-2xs flex items-center gap-1.5 rounded-lg border border-subtle bg-surface-1 px-2.5 py-1.5 font-medium text-primary transition-colors hover:bg-surface-2"
        >
          <Users size={13} />
          <span>Manage Members</span>
        </button>
      </div>

      <p className="mt-2 text-[11px] text-secondary">52 members</p>
    </div>
  );
};
