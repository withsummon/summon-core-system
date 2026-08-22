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

export const CredentialDetailPanel: React.FC<ICredentialDetailPanelProps> = ({
  credential,
  onClose,
  onDelete,
}) => {
  const [activeTab, setActiveTab] = useState("Overview");
  const [isPasswordRevealed, setIsPasswordRevealed] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!credential) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-subtle bg-surface-1 p-8 text-secondary text-xs">
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
    <div className="flex flex-col rounded-xl border border-subtle bg-surface-1 shadow-xs overflow-hidden h-full">
      {/* Panel Top Header */}
      <div className="flex items-center justify-between border-b border-subtle px-5 py-3.5 bg-surface-2/40">
        <h2 className="text-xs font-semibold text-primary">Credential Details</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-placeholder hover:bg-surface-2 hover:text-primary transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Identity Banner */}
      <div className="p-5 border-b border-subtle bg-surface-1">
        <div className="flex items-start gap-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:border-blue-800 shadow-2xs">
            <IconComponent size={20} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-primary truncate">{credential.name}</h3>
              <span className="rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-semibold">
                Active
              </span>
            </div>
            <p className="text-xs text-secondary mt-0.5">
              {credential.type} Access • {credential.environment} Environment
            </p>
            <p className="text-[10px] text-placeholder mt-1">
              Last used {credential.lastUsed} • Created {credential.createdBy.date}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-subtle px-5 bg-surface-1 overflow-x-auto hide-horizontal-scrollbar">
        <div className="flex gap-4">
          {TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "relative py-2.5 text-xs font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "text-blue-600 dark:text-blue-400 font-semibold"
                    : "text-secondary hover:text-primary"
                )}
              >
                {tab}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail Content (2 Sub-columns: Fields & Sidebar Actions) */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Sub-column: Fields (7 cols) */}
          <div className="lg:col-span-7 space-y-4 text-xs">
            {/* Username */}
            <div className="flex items-center justify-between py-1 border-b border-subtle">
              <span className="text-[11px] text-secondary">Username</span>
              <div className="flex items-center gap-1.5 font-medium text-primary">
                <span className="font-mono">{credential.username}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(credential.username, "Username")}
                  className="text-placeholder hover:text-primary transition-colors"
                >
                  {copiedField === "Username" ? (
                    <Check size={12} className="text-emerald-600" />
                  ) : (
                    <Copy size={12} />
                  )}
                </button>
              </div>
            </div>

            {/* Password */}
            <div className="flex items-center justify-between py-1 border-b border-subtle">
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
                  className="text-placeholder hover:text-primary transition-colors"
                >
                  {isPasswordRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      credential.passwordRaw || "BSB_Prod_Secure#2024!xK",
                      "Password"
                    )
                  }
                  className="text-placeholder hover:text-primary transition-colors"
                >
                  {copiedField === "Password" ? (
                    <Check size={12} className="text-emerald-600" />
                  ) : (
                    <Copy size={12} />
                  )}
                </button>
              </div>
            </div>

            {/* Host / IP */}
            {credential.hostIp && (
              <div className="flex items-center justify-between py-1 border-b border-subtle">
                <span className="text-[11px] text-secondary">Host / IP</span>
                <div className="flex items-center gap-1.5 font-medium text-primary">
                  <span className="font-mono">{credential.hostIp}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(credential.hostIp!, "Host / IP")}
                    className="text-placeholder hover:text-primary transition-colors"
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
            <div className="grid grid-cols-2 gap-4 py-1 border-b border-subtle">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-secondary">Port</span>
                <span className="font-medium text-primary font-mono">{credential.port || "22"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-secondary">Protocol</span>
                <span className="font-medium text-primary">{credential.protocol || "SSH"}</span>
              </div>
            </div>

            {/* Description */}
            <div className="py-1 border-b border-subtle">
              <span className="text-[11px] text-secondary block mb-1">Description</span>
              <p className="text-xs text-primary leading-relaxed">
                {credential.description || "No description provided."}
              </p>
            </div>

            {/* Tags */}
            <div className="py-1 border-b border-subtle">
              <span className="text-[11px] text-secondary block mb-1.5">Tags</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {credential.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800 px-2 py-0.5 text-[10px] font-medium"
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
            <div className="flex items-center justify-between py-1 border-b border-subtle">
              <span className="text-[11px] text-secondary">Project</span>
              <div className="flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400">
                <span className="truncate max-w-[180px]">{credential.project}</span>
                <ExternalLink size={12} />
              </div>
            </div>

            {/* Environment */}
            <div className="flex items-center justify-between py-1 border-b border-subtle">
              <span className="text-[11px] text-secondary">Environment</span>
              <span className="rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-medium">
                {credential.environment}
              </span>
            </div>

            {/* Created By */}
            <div className="flex items-center justify-between py-1 border-b border-subtle">
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
                <span className="font-medium text-primary">
                  {credential.passwordRotationPolicy || "Every 90 days"}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setToast({
                      type: TOAST_TYPE.INFO,
                      title: "Rotation Policy",
                      message: "Configuring automatic secret rotation.",
                    })
                  }
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  Edit
                </button>
              </div>
            </div>
          </div>

          {/* Right Sub-column: Quick Actions & Access Summary (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Quick Actions Card */}
            <div className="rounded-xl border border-subtle bg-surface-1 p-3.5 shadow-2xs">
              <h4 className="text-xs font-semibold text-primary mb-2.5">Quick Actions</h4>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setIsPasswordRevealed(!isPasswordRevealed)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-primary hover:bg-surface-2 transition-colors text-left"
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
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-primary hover:bg-surface-2 transition-colors text-left"
                >
                  <Pencil size={13} className="text-blue-600" />
                  <span>Update Credential</span>
                </button>

                <button
                  type="button"
                  onClick={handleRotatePassword}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-primary hover:bg-surface-2 transition-colors text-left"
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
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-primary hover:bg-surface-2 transition-colors text-left"
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
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-primary hover:bg-surface-2 transition-colors text-left"
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
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors text-left"
                >
                  <Trash2 size={13} className="text-red-600" />
                  <span>Delete</span>
                </button>
              </div>
            </div>

            {/* Access Summary Card */}
            <div className="rounded-xl border border-subtle bg-surface-1 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between mb-2.5">
                <h4 className="text-xs font-semibold text-primary">Access Summary</h4>
                <button
                  type="button"
                  className="text-[10px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  View all
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-secondary">Owner</span>
                  <span className="font-medium text-primary">{credential.accessSummary.owner}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-secondary">Users with access</span>
                  <span className="font-medium text-primary font-mono">
                    {credential.accessSummary.usersWithAccess}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-secondary">User groups</span>
                  <span className="font-medium text-primary font-mono">
                    {credential.accessSummary.userGroups}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-subtle">
                  <span className="text-[11px] text-secondary">Last accessed by</span>
                  <div className="text-right">
                    <span className="font-medium text-primary block">
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
      <div className="border-t border-subtle p-3.5 bg-blue-50/50 dark:bg-blue-950/20 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="flex size-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 shrink-0">
            <Shield size={13} />
          </div>
          <p className="text-secondary text-[11px] leading-relaxed">
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
          className="text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 whitespace-nowrap"
        >
          Learn more
        </button>
      </div>
    </div>
  );
};
