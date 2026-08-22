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
    <div className="flex w-full flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
      {/* Title & Shield Badge */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-primary">Credential Vault</h1>
          <div className="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 flex size-5 items-center justify-center rounded-full">
            <Shield size={13} />
          </div>
        </div>
        <p className="text-xs mt-0.5 text-secondary">
          Securely store and manage accounts, API keys, and access credentials.
        </p>
      </div>

      {/* Middle & Right Header Controls */}
      <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
        {/* Search bar with ⌘ K */}
        <div className="relative flex-1 sm:w-72">
          <div className="shadow-2xs focus-within:border-blue-500 flex items-center rounded-xl border border-subtle bg-surface-1 px-3 py-1.5 transition-all">
            <Search size={14} className="mr-2 shrink-0 text-placeholder" />
            <input
              type="text"
              placeholder="Search credentials, projects, accounts..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="text-xs w-full bg-transparent text-primary placeholder:text-placeholder focus:outline-none"
            />
            <span className="hidden rounded border border-subtle bg-surface-2 px-1.5 py-0.5 text-[9px] font-medium text-secondary sm:inline-block">
              ⌘ K
            </span>
          </div>
        </div>

        {/* Action icons & Add Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleFilter}
            className="text-xs shadow-2xs flex items-center gap-1.5 rounded-lg border border-subtle bg-surface-1 px-3 py-1.5 font-medium text-secondary transition-colors hover:border-strong hover:text-primary"
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
            className="shadow-2xs flex size-8 items-center justify-center rounded-lg border border-subtle bg-surface-1 text-secondary transition-colors hover:text-primary"
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
            className="shadow-2xs flex size-8 items-center justify-center rounded-lg border border-subtle bg-surface-1 text-secondary transition-colors hover:text-primary"
          >
            <History size={14} />
          </button>

          <button
            type="button"
            onClick={onOpenAddModal}
            className="bg-blue-600 text-xs hover:bg-blue-700 shadow-xs flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-semibold text-white transition-colors"
          >
            <Plus size={14} />
            <span>Add Credential</span>
          </button>
        </div>
      </div>
    </div>
  );
};
