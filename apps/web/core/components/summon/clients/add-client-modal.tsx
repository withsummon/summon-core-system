/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { X, Building2, Plus } from "lucide-react";
import type { IClientDetail } from "./types";

interface IAddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (client: Partial<IClientDetail>) => void;
}

export function AddClientModal({ isOpen, onClose, onSave }: IAddClientModalProps) {
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [industry, setIndustry] = useState("Financial Services");
  const [website, setWebsite] = useState("");
  const [headOffice, setHeadOffice] = useState("Jakarta, Indonesia");
  const [accountManager, setAccountManager] = useState("Fikri Adriansyah");
  const [description, setDescription] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      legalName: legalName || name,
      industry,
      website,
      headOffice,
      accountManager: { name: accountManager },
      description,
      status: "Active Client",
      since: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="shadow-2xl flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-subtle bg-surface-1">
        <div className="flex items-center justify-between border-b border-subtle px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex size-9 items-center justify-center rounded-xl">
              <Building2 className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-primary">Add New Client Account</h2>
              <p className="text-xs text-secondary">Create a commercial enterprise client profile</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-secondary hover:bg-layer-1 hover:text-primary"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 p-6">
          <div>
            <label htmlFor="client-name" className="text-xs block font-semibold text-primary">
              Client Common Name *
            </label>
            <input
              id="client-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pegadaian"
              className="text-xs focus:border-accent-primary mt-1 w-full rounded-lg border border-subtle bg-layer-1 p-2 text-primary focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="legal-name" className="text-xs block font-semibold text-primary">
              Legal Company Name
            </label>
            <input
              id="legal-name"
              type="text"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="e.g. PT Pegadaian (Persero)"
              className="text-xs focus:border-accent-primary mt-1 w-full rounded-lg border border-subtle bg-layer-1 p-2 text-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="industry-select" className="text-xs block font-semibold text-primary">
                Industry
              </label>
              <select
                id="industry-select"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="text-xs focus:border-accent-primary mt-1 w-full rounded-lg border border-subtle bg-layer-1 p-2 text-primary focus:outline-none"
              >
                <option>Financial Services</option>
                <option>Banking</option>
                <option>Fintech & Lending</option>
                <option>Multi-finance</option>
                <option>Telecommunications</option>
                <option>Public Sector</option>
              </select>
            </div>
            <div>
              <label htmlFor="client-website" className="text-xs block font-semibold text-primary">
                Website
              </label>
              <input
                id="client-website"
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="www.client.co.id"
                className="text-xs focus:border-accent-primary mt-1 w-full rounded-lg border border-subtle bg-layer-1 p-2 text-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="head-office" className="text-xs block font-semibold text-primary">
                Head Office
              </label>
              <input
                id="head-office"
                type="text"
                value={headOffice}
                onChange={(e) => setHeadOffice(e.target.value)}
                placeholder="Jakarta, Indonesia"
                className="text-xs focus:border-accent-primary mt-1 w-full rounded-lg border border-subtle bg-layer-1 p-2 text-primary focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="account-manager" className="text-xs block font-semibold text-primary">
                Account Manager
              </label>
              <input
                id="account-manager"
                type="text"
                value={accountManager}
                onChange={(e) => setAccountManager(e.target.value)}
                placeholder="Fikri Adriansyah"
                className="text-xs focus:border-accent-primary mt-1 w-full rounded-lg border border-subtle bg-layer-1 p-2 text-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="client-description" className="text-xs block font-semibold text-primary">
              Description & Bio
            </label>
            <textarea
              id="client-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enterprise business overview..."
              className="text-xs focus:border-accent-primary mt-1 w-full rounded-lg border border-subtle bg-layer-1 p-2 text-primary focus:outline-none"
            />
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-subtle pt-4">
            <button
              type="button"
              onClick={onClose}
              className="text-xs rounded-lg border border-subtle bg-surface-1 px-4 py-2 font-semibold text-secondary hover:bg-layer-1 hover:text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="text-xs shadow-sm flex items-center gap-1.5 rounded-lg bg-accent-primary px-5 py-2 font-bold text-white hover:bg-accent-primary/90"
            >
              <Plus className="size-3.5" />
              Save Client
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
