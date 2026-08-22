/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { Pencil, Copy, Sparkles, Check, ChevronDown } from "lucide-react";
import { cn } from "@plane/utils";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { INITIAL_COMPANY_PROFILE } from "./mock-data";
import type { ICompanyProfileForm } from "./types";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const CompanyProfileCard: React.FC = () => {
  const [formData, setFormData] = useState<ICompanyProfileForm>(INITIAL_COMPANY_PROFILE);
  const [isCopied, setIsCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const toggleDay = (day: string) => {
    setFormData((prev) => {
      const exists = prev.workingDays.includes(day);
      return {
        ...prev,
        workingDays: exists ? prev.workingDays.filter((d) => d !== day) : [...prev.workingDays, day],
      };
    });
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(`https://${formData.workspaceUrl}`);
    setIsCopied(true);
    setToast({
      type: TOAST_TYPE.SUCCESS,
      title: "URL Copied",
      message: "Workspace URL copied to clipboard.",
    });
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Changes Saved",
        message: "Company profile and workspace settings updated successfully.",
      });
    }, 600);
  };

  return (
    <div className="shadow-xs flex flex-col rounded-xl border border-subtle bg-surface-1 p-5">
      {/* Header */}
      <div>
        <h2 className="text-sm font-semibold text-primary">Company Profile</h2>
        <p className="text-xs mt-0.5 text-secondary">Update your company information and workspace settings.</p>
      </div>

      <div className="mt-5 space-y-4">
        {/* Logo and Name/URL row */}
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          {/* Logo with edit button overlay */}
          <div className="group relative shrink-0">
            <div className="from-blue-600 to-indigo-600 shadow-sm flex size-16 items-center justify-center rounded-2xl bg-gradient-to-tr text-white">
              <Sparkles size={28} className="text-white" />
            </div>
            <button
              type="button"
              onClick={() =>
                setToast({
                  type: TOAST_TYPE.INFO,
                  title: "Change Logo",
                  message: "Select an image file to update workspace logo.",
                })
              }
              className="shadow-xs absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full border border-subtle bg-surface-1 text-secondary transition-colors hover:border-strong hover:text-primary"
            >
              <Pencil size={11} />
            </button>
          </div>

          {/* Company Name & Workspace URL */}
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-secondary">Company / Workspace Name</label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="text-xs focus:border-blue-500 w-full rounded-lg border border-subtle bg-surface-2 px-3 py-1.5 text-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-secondary">Workspace URL</label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={formData.workspaceUrl}
                  onChange={(e) => setFormData({ ...formData, workspaceUrl: e.target.value })}
                  className="text-xs focus:border-blue-500 w-full rounded-lg border border-subtle bg-surface-2 py-1.5 pr-8 pl-3 text-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="absolute right-2 text-placeholder transition-colors hover:text-primary"
                >
                  {isCopied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Industry & Company Size */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-secondary">Industry</label>
            <select
              value={formData.industry}
              onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
              className="text-xs focus:border-blue-500 w-full rounded-lg border border-subtle bg-surface-2 px-3 py-1.5 text-primary focus:outline-none"
            >
              <option value="Technology, Information & Internet">Technology, Information & Internet</option>
              <option value="Financial Services">Financial Services</option>
              <option value="Logistics & Supply Chain">Logistics & Supply Chain</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Consulting">Consulting</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-secondary">Company Size</label>
            <select
              value={formData.companySize}
              onChange={(e) => setFormData({ ...formData, companySize: e.target.value })}
              className="text-xs focus:border-blue-500 w-full rounded-lg border border-subtle bg-surface-2 px-3 py-1.5 text-primary focus:outline-none"
            >
              <option value="1 - 10 employees">1 - 10 employees</option>
              <option value="11 - 50 employees">11 - 50 employees</option>
              <option value="51 - 200 employees">51 - 200 employees</option>
              <option value="201 - 500 employees">201 - 500 employees</option>
              <option value="500+ employees">500+ employees</option>
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-secondary">Description</label>
          <div className="relative">
            <textarea
              rows={2}
              maxLength={500}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="text-xs focus:border-blue-500 w-full resize-none rounded-lg border border-subtle bg-surface-2 p-2.5 text-primary focus:outline-none"
            />
            <span className="absolute right-2 bottom-2 text-[10px] text-placeholder">
              {formData.description.length}/500
            </span>
          </div>
        </div>

        {/* Time Zone & Currency */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-secondary">Time Zone</label>
            <select
              value={formData.timeZone}
              onChange={(e) => setFormData({ ...formData, timeZone: e.target.value })}
              className="text-xs focus:border-blue-500 w-full rounded-lg border border-subtle bg-surface-2 px-3 py-1.5 text-primary focus:outline-none"
            >
              <option value="(GMT+7) Jakarta, Indonesia">(GMT+7) Jakarta, Indonesia</option>
              <option value="(GMT+8) Singapore">(GMT+8) Singapore</option>
              <option value="(GMT+0) London, UTC">(GMT+0) London, UTC</option>
              <option value="(GMT-5) New York, EST">(GMT-5) New York, EST</option>
            </select>
            <p className="mt-1 text-[10px] text-placeholder">
              This will be used for all date and time in your workspace.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-secondary">Currency</label>
            <select
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className="text-xs focus:border-blue-500 w-full rounded-lg border border-subtle bg-surface-2 px-3 py-1.5 text-primary focus:outline-none"
            >
              <option value="IDR - Indonesian Rupiah">IDR - Indonesian Rupiah</option>
              <option value="USD - US Dollar">USD - US Dollar</option>
              <option value="SGD - Singapore Dollar">SGD - Singapore Dollar</option>
              <option value="EUR - Euro">EUR - Euro</option>
            </select>
            <p className="mt-1 text-[10px] text-placeholder">This will be used for all financial values.</p>
          </div>
        </div>

        {/* Workweek */}
        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-secondary">Workweek</label>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="w-full sm:w-48">
              <span className="mb-1 block text-[10px] text-placeholder">Start of week</span>
              <select
                value={formData.startOfWeek}
                onChange={(e) => setFormData({ ...formData, startOfWeek: e.target.value })}
                className="text-xs focus:border-blue-500 w-full rounded-lg border border-subtle bg-surface-2 px-3 py-1.5 text-primary focus:outline-none"
              >
                <option value="Monday">Monday</option>
                <option value="Sunday">Sunday</option>
              </select>
            </div>

            <div className="flex-1">
              <span className="mb-1 block text-[10px] text-placeholder">Working days</span>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((day) => {
                  const isSelected = formData.workingDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={cn(
                        "text-xs rounded-md px-2.5 py-1 font-medium transition-colors",
                        isSelected
                          ? "bg-blue-600 shadow-2xs text-white"
                          : "border border-subtle bg-surface-2 text-secondary hover:border-strong"
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 border-t border-subtle pt-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="bg-blue-600 text-xs hover:bg-blue-700 shadow-xs rounded-lg px-4 py-2 font-semibold text-white transition-colors disabled:opacity-70"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={() => setFormData(INITIAL_COMPANY_PROFILE)}
            className="text-xs rounded-lg border border-subtle bg-surface-1 px-4 py-2 font-medium text-secondary transition-colors hover:bg-surface-2 hover:text-primary"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
