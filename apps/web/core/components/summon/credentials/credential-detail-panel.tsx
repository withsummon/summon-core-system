/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import {
  X,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  ExternalLink,
  Shield,
  Server,
  Cloud,
  Database,
  Key,
  Globe,
  HardDrive,
  Share2,
  Trash2,
  Plus,
  Pencil,
  RotateCw,
} from "lucide-react";
import { cn } from "@plane/utils";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { ICredentialItem, TCredentialType } from "./types";

interface ICredentialDetailPanelProps {
  credential: ICredentialItem | null;
  onClose?: () => void;
  onDelete?: (id: string) => void;
}

const TABS = ["Overview", "Access", "Activity Log", "Attachments", "Notes"];

const getTypeIcon = (type: TCredentialType) => {
  switch (type) {
    case "Server":
      return Server;
    case "Cloud":
      return Cloud;
    case "Database":
      return Database;
    case "API Key":
      return Key;
    case "SaaS":
      return Globe;
    case "Storage":
      return HardDrive;
    default:
      return Server;
  }
};

export const CredentialDetailPanel: React.FC<ICredentialDetailPanelProps> = ({ credential, onClose, onDelete }) => {
  const [activeTab, setActiveTab] = useState("Overview");
  const [isPasswordRevealed, setIsPasswordRevealed] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!credential) {
    return (
      <div className="text-xs flex h-full items-center justify-center rounded-xl border border-subtle bg-surface-1 p-8 text-secondary">
        Select a credential from the list to view details.
      </div>
    );
  }

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setToast({
      type: TOAST_TYPE.SUCCESS,
      title: "Copied to clipboard",
      message: `${fieldName} copied.`,
    });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleRotatePassword = () => {
    setToast({
      type: TOAST_TYPE.SUCCESS,
      title: "Password Rotated",
      message: `Generated a new AES-256 encrypted secret for ${credential.name}.`,
    });
  };

  const IconComponent = getTypeIcon(credential.type);

  return (
    <div className="shadow-xs flex h-full flex-col overflow-hidden rounded-xl border border-subtle bg-surface-1">
      {/* Panel Top Header */}
      <div className="flex items-center justify-between border-b border-subtle bg-surface-2/40 px-5 py-3.5">
        <h2 className="text-xs font-semibold text-primary">Credential Details</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-placeholder transition-colors hover:bg-surface-2 hover:text-primary"
        >
          <X size={14} />
        </button>
      </div>

      {/* Identity Banner */}
      <div className="border-b border-subtle bg-surface-1 p-5">
        <div className="flex items-start gap-3.5">
          <div className="border-blue-200 bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:border-blue-800 shadow-2xs flex size-10 shrink-0 items-center justify-center rounded-xl border">
            <IconComponent size={20} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm truncate font-bold text-primary">{credential.name}</h3>
              <span className="bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 rounded-full border px-2 py-0.5 text-[10px] font-semibold">
                Active
              </span>
            </div>
            <p className="text-xs mt-0.5 text-secondary">
              {credential.type} Access • {credential.environment} Environment
            </p>
            <p className="mt-1 text-[10px] text-placeholder">
              Last used {credential.lastUsed} • Created {credential.createdBy.date}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="hide-horizontal-scrollbar flex overflow-x-auto border-b border-subtle bg-surface-1 px-5">
        <div className="flex gap-4">
          {TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "text-xs relative py-2.5 font-medium whitespace-nowrap transition-colors",
                  isActive ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-secondary hover:text-primary"
                )}
              >
                {tab}
                {isActive && (
                  <span className="bg-blue-600 dark:bg-blue-400 absolute right-0 bottom-0 left-0 h-0.5 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail Content (2 Sub-columns: Fields & Sidebar Actions) */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
          {/* Left Sub-column: Fields (7 cols) */}
          <div className="text-xs space-y-4 lg:col-span-7">
            {/* Username */}
            <div className="flex items-center justify-between border-b border-subtle py-1">
              <span className="text-[11px] text-secondary">Username</span>
              <div className="flex items-center gap-1.5 font-medium text-primary">
                <span className="font-mono">{credential.username}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(credential.username, "Username")}
                  className="text-placeholder transition-colors hover:text-primary"
                >
                  {copiedField === "Username" ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                </button>
              </div>
            </div>

            {/* Password */}
            <div className="flex items-center justify-between border-b border-subtle py-1">
              <span className="text-[11px] text-secondary">Password</span>
              <div className="flex items-center gap-2 font-medium text-primary">
                <span className="font-mono text-sm tracking-wider">
                  {isPasswordRevealed
                    ? credential.passwordRaw || "BSB_Prod_Secure#2024!xK"
                    : credential.passwordMasked || "••••••••••••••••"}
                </span>
                <button
                  type="button"
                  onClick={() => setIsPasswordRevealed(!isPasswordRevealed)}
                  className="text-placeholder transition-colors hover:text-primary"
                >
                  {isPasswordRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(credential.passwordRaw || "BSB_Prod_Secure#2024!xK", "Password")}
                  className="text-placeholder transition-colors hover:text-primary"
                >
                  {copiedField === "Password" ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                </button>
              </div>
            </div>

            {/* Host / IP */}
            {credential.hostIp && (
              <div className="flex items-center justify-between border-b border-subtle py-1">
                <span className="text-[11px] text-secondary">Host / IP</span>
                <div className="flex items-center gap-1.5 font-medium text-primary">
                  <span className="font-mono">{credential.hostIp}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(credential.hostIp!, "Host / IP")}
                    className="text-placeholder transition-colors hover:text-primary"
                  >
                    {copiedField === "Host / IP" ? (
                      <Check size={12} className="text-emerald-600" />
                    ) : (
                      <Copy size={12} />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Port & Protocol */}
            <div className="grid grid-cols-2 gap-4 border-b border-subtle py-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-secondary">Port</span>
                <span className="font-mono font-medium text-primary">{credential.port || "22"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-secondary">Protocol</span>
                <span className="font-medium text-primary">{credential.protocol || "SSH"}</span>
              </div>
            </div>

            {/* Description */}
            <div className="border-b border-subtle py-1">
              <span className="mb-1 block text-[11px] text-secondary">Description</span>
              <p className="text-xs leading-relaxed text-primary">
                {credential.description || "No description provided."}
              </p>
            </div>

            {/* Tags */}
            <div className="border-b border-subtle py-1">
              <span className="mb-1.5 block text-[11px] text-secondary">Tags</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {credential.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800 rounded-md border px-2 py-0.5 text-[10px] font-medium"
                  >
                    {tag}
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setToast({
                      type: TOAST_TYPE.INFO,
                      title: "Add Tag",
                      message: "Tag editor ready.",
                    })
                  }
                  className="flex size-5 items-center justify-center rounded-md border border-subtle text-placeholder hover:text-primary"
                >
                  <Plus size={11} />
                </button>
              </div>
            </div>

            {/* Project */}
            <div className="flex items-center justify-between border-b border-subtle py-1">
              <span className="text-[11px] text-secondary">Project</span>
              <div className="text-blue-600 dark:text-blue-400 flex items-center gap-1 font-medium">
                <span className="max-w-[180px] truncate">{credential.project}</span>
                <ExternalLink size={12} />
              </div>
            </div>

            {/* Environment */}
            <div className="flex items-center justify-between border-b border-subtle py-1">
              <span className="text-[11px] text-secondary">Environment</span>
              <span className="bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 rounded-full border px-2 py-0.5 text-[10px] font-medium">
                {credential.environment}
              </span>
            </div>

            {/* Created By */}
            <div className="flex items-center justify-between border-b border-subtle py-1">
              <span className="text-[11px] text-secondary">Created By</span>
              <div className="flex items-center gap-2">
                {credential.createdBy.avatar ? (
                  <img
                    src={credential.createdBy.avatar}
                    alt={credential.createdBy.name}
                    className="size-5 rounded-full object-cover"
                  />
                ) : null}
                <span className="font-medium text-primary">{credential.createdBy.name}</span>
                <span className="text-placeholder">• {credential.createdBy.date}</span>
              </div>
            </div>

            {/* Password Rotation Policy */}
            <div className="flex items-center justify-between py-1">
              <span className="text-[11px] text-secondary">Password Rotation</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-primary">{credential.passwordRotationPolicy || "Every 90 days"}</span>
                <button
                  type="button"
                  onClick={() =>
                    setToast({
                      type: TOAST_TYPE.INFO,
                      title: "Rotation Policy",
                      message: "Configuring automatic secret rotation.",
                    })
                  }
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-[11px] font-medium"
                >
                  Edit
                </button>
              </div>
            </div>
          </div>

          {/* Right Sub-column: Quick Actions & Access Summary (5 cols) */}
          <div className="space-y-4 lg:col-span-5">
            {/* Quick Actions Card */}
            <div className="shadow-2xs rounded-xl border border-subtle bg-surface-1 p-3.5">
              <h4 className="text-xs mb-2.5 font-semibold text-primary">Quick Actions</h4>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setIsPasswordRevealed(!isPasswordRevealed)}
                  className="text-xs flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-primary transition-colors hover:bg-surface-2"
                >
                  <Eye size={13} className="text-blue-600" />
                  <span>Reveal Password</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setToast({
                      type: TOAST_TYPE.INFO,
                      title: "Update Credential",
                      message: "Opening update dialog.",
                    })
                  }
                  className="text-xs flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-primary transition-colors hover:bg-surface-2"
                >
                  <Pencil size={13} className="text-blue-600" />
                  <span>Update Credential</span>
                </button>

                <button
                  type="button"
                  onClick={handleRotatePassword}
                  className="text-xs flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-primary transition-colors hover:bg-surface-2"
                >
                  <RotateCw size={13} className="text-blue-600" />
                  <span>Rotate Password</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setToast({
                      type: TOAST_TYPE.INFO,
                      title: "Share Access",
                      message: "Manage team and member access permissions.",
                    })
                  }
                  className="text-xs flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-primary transition-colors hover:bg-surface-2"
                >
                  <Share2 size={13} className="text-blue-600" />
                  <span>Share Access</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setToast({
                      type: TOAST_TYPE.INFO,
                      title: "Duplicate",
                      message: `Duplicated ${credential.name} as draft.`,
                    })
                  }
                  className="text-xs flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-primary transition-colors hover:bg-surface-2"
                >
                  <Copy size={13} className="text-secondary" />
                  <span>Duplicate</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onDelete?.(credential.id);
                    setToast({
                      type: TOAST_TYPE.SUCCESS,
                      title: "Credential Deleted",
                      message: `${credential.name} removed from vault.`,
                    });
                  }}
                  className="text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors"
                >
                  <Trash2 size={13} className="text-red-600" />
                  <span>Delete</span>
                </button>
              </div>
            </div>

            {/* Access Summary Card */}
            <div className="shadow-2xs rounded-xl border border-subtle bg-surface-1 p-3.5">
              <div className="mb-2.5 flex items-center justify-between">
                <h4 className="text-xs font-semibold text-primary">Access Summary</h4>
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-[10px] font-medium"
                >
                  View all
                </button>
              </div>

              <div className="text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-secondary">Owner</span>
                  <span className="font-medium text-primary">{credential.accessSummary.owner}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-secondary">Users with access</span>
                  <span className="font-mono font-medium text-primary">{credential.accessSummary.usersWithAccess}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-secondary">User groups</span>
                  <span className="font-mono font-medium text-primary">{credential.accessSummary.userGroups}</span>
                </div>

                <div className="flex items-center justify-between border-t border-subtle pt-1">
                  <span className="text-[11px] text-secondary">Last accessed by</span>
                  <div className="text-right">
                    <span className="block font-medium text-primary">
                      {credential.accessSummary.lastAccessedBy.name}
                    </span>
                    <span className="text-[10px] text-placeholder">
                      {credential.accessSummary.lastAccessedBy.timeAgo}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Security Banner Callout */}
      <div className="bg-blue-50/50 dark:bg-blue-950/20 text-xs flex items-center justify-between gap-3 border-t border-subtle p-3.5">
        <div className="flex items-center gap-2.5">
          <div className="bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 flex size-6 shrink-0 items-center justify-center rounded-full">
            <Shield size={13} />
          </div>
          <p className="text-[11px] leading-relaxed text-secondary">
            This credential is encrypted and stored securely. Only authorized users and groups can access it.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setToast({
              type: TOAST_TYPE.INFO,
              title: "Security Documentation",
              message: "Opening Summon KMS zero-knowledge encryption guide.",
            })
          }
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-[11px] font-medium whitespace-nowrap"
        >
          Learn more
        </button>
      </div>
    </div>
  );
};
