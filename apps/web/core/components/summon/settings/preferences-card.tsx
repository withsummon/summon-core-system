/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@plane/utils";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { INITIAL_WORKSPACE_PREFERENCES } from "./mock-data";
import type { IWorkspacePreferencesForm } from "./types";

export const PreferencesCard: React.FC = () => {
  const [prefs, setPrefs] = useState<IWorkspacePreferencesForm>(INITIAL_WORKSPACE_PREFERENCES);

  const updateField = <K extends keyof IWorkspacePreferencesForm>(key: K, val: IWorkspacePreferencesForm[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: val }));
    setToast({
      type: TOAST_TYPE.INFO,
      title: "Preference Updated",
      message: `Updated ${key} setting.`,
    });
  };

  return (
    <div className="flex flex-col rounded-xl border border-subtle bg-surface-1 p-5 shadow-xs">
      <div>
        <h2 className="text-sm font-semibold text-primary">Preferences</h2>
        <p className="text-xs text-secondary mt-0.5">Set your preferences for the workspace.</p>
      </div>

      <div className="mt-4 space-y-4">
        {/* Row 1: Language & Default Landing Page */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-medium text-secondary block mb-1">Language</label>
            <select
              value={prefs.language}
              onChange={(e) => updateField("language", e.target.value)}
              className="w-full rounded-lg border border-subtle bg-surface-2 px-3 py-1.5 text-xs text-primary focus:border-blue-500 focus:outline-none"
            >
              <option value="English">English</option>
              <option value="Bahasa Indonesia">Bahasa Indonesia</option>
              <option value="Japanese">Japanese</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-medium text-secondary block mb-1">
              Default Landing Page
            </label>
            <select
              value={prefs.defaultLandingPage}
              onChange={(e) => updateField("defaultLandingPage", e.target.value)}
              className="w-full rounded-lg border border-subtle bg-surface-2 px-3 py-1.5 text-xs text-primary focus:border-blue-500 focus:outline-none"
            >
              <option value="Home">Home</option>
              <option value="Projects">Projects</option>
              <option value="Opportunities">Opportunities</option>
              <option value="Knowledge">Knowledge</option>
              <option value="Automation">Automation Studio</option>
            </select>
          </div>
        </div>

        {/* Row 2: Date Format & Items Per Page */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-medium text-secondary block mb-1">Date Format</label>
            <select
              value={prefs.dateFormat}
              onChange={(e) => updateField("dateFormat", e.target.value)}
              className="w-full rounded-lg border border-subtle bg-surface-2 px-3 py-1.5 text-xs text-primary focus:border-blue-500 focus:outline-none"
            >
              <option value="20 August 2025">20 August 2025 (DD MMMM YYYY)</option>
              <option value="August 20, 2025">August 20, 2025 (MMMM DD, YYYY)</option>
              <option value="2025-08-20">2025-08-20 (YYYY-MM-DD)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-medium text-secondary block mb-1">
              Items Per Page
            </label>
            <select
              value={prefs.itemsPerPage}
              onChange={(e) => updateField("itemsPerPage", Number(e.target.value))}
              className="w-full rounded-lg border border-subtle bg-surface-2 px-3 py-1.5 text-xs text-primary focus:border-blue-500 focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Row 3: Time Format & Theme */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <div>
            <label className="text-[11px] font-medium text-secondary block mb-2">Time Format</label>
            <div className="flex items-center gap-4 text-xs text-primary">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="timeFormat"
                  checked={prefs.timeFormat === "12-hour"}
                  onChange={() => updateField("timeFormat", "12-hour")}
                  className="accent-blue-600 size-3.5"
                />
                <span>12-hour (AM/PM)</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="timeFormat"
                  checked={prefs.timeFormat === "24-hour"}
                  onChange={() => updateField("timeFormat", "24-hour")}
                  className="accent-blue-600 size-3.5"
                />
                <span>24-hour</span>
              </label>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-secondary block mb-1.5">Theme</label>
            <div className="flex items-center rounded-lg border border-subtle bg-surface-2 p-1 gap-1">
              <button
                type="button"
                onClick={() => updateField("theme", "light")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 text-xs font-medium transition-colors",
                  prefs.theme === "light"
                    ? "bg-surface-1 text-primary shadow-xs border border-subtle"
                    : "text-secondary hover:text-primary"
                )}
              >
                <Sun size={13} />
                <span>Light</span>
              </button>

              <button
                type="button"
                onClick={() => updateField("theme", "dark")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 text-xs font-medium transition-colors",
                  prefs.theme === "dark"
                    ? "bg-surface-1 text-primary shadow-xs border border-subtle"
                    : "text-secondary hover:text-primary"
                )}
              >
                <Moon size={13} />
                <span>Dark</span>
              </button>

              <button
                type="button"
                onClick={() => updateField("theme", "system")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 text-xs font-medium transition-colors",
                  prefs.theme === "system"
                    ? "bg-surface-1 text-primary shadow-xs border border-subtle"
                    : "text-secondary hover:text-primary"
                )}
              >
                <Monitor size={13} />
                <span>System</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
