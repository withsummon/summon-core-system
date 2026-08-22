/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { Shield, Search, Filter, Lock, History, Plus } from "lucide-react";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";

interface ICredentialsHeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenAddModal: () => void;
  onToggleFilter?: () => void;
}

export const CredentialsHeader: React.FC<ICredentialsHeaderProps> = ({
  searchQuery,
  onSearchChange,
  onOpenAddModal,
  onToggleFilter,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full">
      {/* Title & Shield Badge */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-primary">Credential Vault</h1>
          <div className="flex size-5 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
            <Shield size={13} />
          </div>
        </div>
        <p className="text-xs text-secondary mt-0.5">
          Securely store and manage accounts, API keys, and access credentials.
        </p>
      </div>

      {/* Middle & Right Header Controls */}
      <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
        {/* Search bar with ⌘ K */}
        <div className="relative flex-1 sm:w-72">
          <div className="flex items-center rounded-xl border border-subtle bg-surface-1 px-3 py-1.5 shadow-2xs focus-within:border-blue-500 transition-all">
            <Search size={14} className="text-placeholder mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search credentials, projects, accounts..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-transparent text-xs text-primary placeholder:text-placeholder focus:outline-none"
            />
            <span className="hidden sm:inline-block rounded border border-subtle bg-surface-2 px-1.5 py-0.5 text-[9px] font-medium text-secondary">
              ⌘ K
            </span>
          </div>
        </div>

        {/* Action icons & Add Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleFilter}
            className="flex items-center gap-1.5 rounded-lg border border-subtle bg-surface-1 px-3 py-1.5 text-xs font-medium text-secondary hover:border-strong hover:text-primary transition-colors shadow-2xs"
          >
            <Filter size={13} />
            <span>Filter</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setToast({
                type: TOAST_TYPE.INFO,
                title: "Vault Locked",
                message: "Credential vault session is encrypted with AES-256 GCM.",
              })
            }
            className="flex size-8 items-center justify-center rounded-lg border border-subtle bg-surface-1 text-secondary hover:text-primary transition-colors shadow-2xs"
          >
            <Lock size={14} />
          </button>

          <button
            type="button"
            onClick={() =>
              setToast({
                type: TOAST_TYPE.INFO,
                title: "Audit History",
                message: "Viewing vault access logs and rotation history.",
              })
            }
            className="flex size-8 items-center justify-center rounded-lg border border-subtle bg-surface-1 text-secondary hover:text-primary transition-colors shadow-2xs"
          >
            <History size={14} />
          </button>

          <button
            type="button"
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-xs"
          >
            <Plus size={14} />
            <span>Add Credential</span>
          </button>
        </div>
      </div>
    </div>
  );
};
