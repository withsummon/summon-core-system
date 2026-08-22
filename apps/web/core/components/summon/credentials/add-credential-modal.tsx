/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { X, Shield } from "lucide-react";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { ICredentialItem, TCredentialEnvironment, TCredentialType } from "./types";

interface IAddCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCredential: (cred: ICredentialItem) => void;
}

export const AddCredentialModal: React.FC<IAddCredentialModalProps> = ({
  isOpen,
  onClose,
  onAddCredential,
}) => {
  const [name, setName] = useState("");
  const [type, setType] = useState<TCredentialType>("Server");
  const [project, setProject] = useState("BSB Logistic Management System");
  const [environment, setEnvironment] = useState<TCredentialEnvironment>("Production");
  const [username, setUsername] = useState("");
  const [secret, setSecret] = useState("");
  const [hostIp, setHostIp] = useState("");
  const [description, setDescription] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newCred: ICredentialItem = {
      id: `cred-${Date.now()}`,
      name,
      identifier: username || name.toLowerCase().replace(/\s+/g, "_"),
      type,
      project,
      environment,
      lastUsed: "Just now",
      status: "active",
      username: username || "root",
      passwordMasked: "••••••••••••••••",
      passwordRaw: secret || "Vault#SecretPass2024",
      hostIp: hostIp || "10.0.0.1",
      port: type === "Database" ? "5432" : "22",
      protocol: type === "Database" ? "PostgreSQL" : "SSH",
      description: description || `Access credentials for ${name}.`,
      tags: [environment.toLowerCase(), type.toLowerCase()],
      createdBy: {
        name: "You",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
        date: "Today",
      },
      passwordRotationPolicy: "Every 90 days",
      accessSummary: {
        owner: "You",
        usersWithAccess: 1,
        userGroups: 1,
        lastAccessedBy: {
          name: "You",
          timeAgo: "Just now",
        },
      },
    };

    onAddCredential(newCred);
    setToast({
      type: TOAST_TYPE.SUCCESS,
      title: "Credential Stored",
      message: `${name} has been encrypted and stored in vault.`,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg rounded-2xl border border-subtle bg-surface-1 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-subtle px-6 py-4 bg-surface-2/40">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <Shield size={14} />
            </div>
            <h2 className="text-sm font-semibold text-primary">Store New Encrypted Credential</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-placeholder hover:bg-surface-2 hover:text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-[11px] font-medium text-secondary block mb-1">
              Credential Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Production Redis Cluster"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-subtle bg-surface-2 px-3 py-2 text-xs text-primary focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-secondary block mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TCredentialType)}
                className="w-full rounded-lg border border-subtle bg-surface-2 px-3 py-2 text-xs text-primary focus:border-blue-500 focus:outline-none"
              >
                <option value="Server">Server</option>
                <option value="Cloud">Cloud</option>
                <option value="Database">Database</option>
                <option value="API Key">API Key</option>
                <option value="SaaS">SaaS</option>
                <option value="Storage">Storage</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-secondary block mb-1">
                Environment
              </label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as TCredentialEnvironment)}
                className="w-full rounded-lg border border-subtle bg-surface-2 px-3 py-2 text-xs text-primary focus:border-blue-500 focus:outline-none"
              >
                <option value="Production">Production</option>
                <option value="Staging">Staging</option>
                <option value="Development">Development</option>
                <option value="Testing">Testing</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-secondary block mb-1">
                Username / Identifier
              </label>
              <input
                type="text"
                placeholder="e.g. admin@withsummon.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-subtle bg-surface-2 px-3 py-2 text-xs text-primary focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-secondary block mb-1">
                Host / Endpoint / IP
              </label>
              <input
                type="text"
                placeholder="e.g. 10.20.30.15"
                value={hostIp}
                onChange={(e) => setHostIp(e.target.value)}
                className="w-full rounded-lg border border-subtle bg-surface-2 px-3 py-2 text-xs text-primary focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-secondary block mb-1">
              Secret / Password *
            </label>
            <input
              type="password"
              required
              placeholder="••••••••••••••••"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="w-full rounded-lg border border-subtle bg-surface-2 px-3 py-2 text-xs text-primary focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-secondary block mb-1">
              Project Context
            </label>
            <input
              type="text"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              className="w-full rounded-lg border border-subtle bg-surface-2 px-3 py-2 text-xs text-primary focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-secondary block mb-1">
              Description
            </label>
            <textarea
              rows={2}
              placeholder="Context and access guidelines..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full resize-none rounded-lg border border-subtle bg-surface-2 p-2.5 text-xs text-primary focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-subtle px-4 py-2 text-xs font-medium text-secondary hover:bg-surface-2 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-xs"
            >
              Store Credential
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
