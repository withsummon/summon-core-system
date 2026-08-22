/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";

interface IResourceBadgeProps {
  category: string;
}

export function ResourceBadge({ category }: IResourceBadgeProps) {
  const cat = category.toLowerCase();

  let label = "Document";
  let colorClasses = "bg-blue-500/10 text-blue-600 dark:text-blue-400";

  if (cat.includes("repo") || cat === "repository") {
    label = "Repository";
    colorClasses = "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400";
  } else if (cat.includes("figma")) {
    label = "Figma";
    colorClasses = "bg-pink-500/10 text-pink-600 dark:text-pink-400";
  } else if (cat.includes("deploy") || cat === "deployment") {
    label = "Deployment";
    colorClasses = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  } else if (cat.includes("drive")) {
    label = "Google Drive";
    colorClasses = "bg-teal-500/10 text-teal-600 dark:text-teal-400";
  } else if (cat.includes("record") || cat === "recording") {
    label = "Recording";
    colorClasses = "bg-purple-500/10 text-purple-600 dark:text-purple-400";
  } else if (cat.includes("account") || cat.includes("credential")) {
    label = "Account";
    colorClasses = "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${colorClasses}`}>
      {label}
    </span>
  );
}
