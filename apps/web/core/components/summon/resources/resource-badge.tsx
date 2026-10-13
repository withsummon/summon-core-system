/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { RESOURCE_KIND_TONE } from "./types";

interface IResourceBadgeProps {
  category: string;
}

export function ResourceBadge({ category }: IResourceBadgeProps) {
  const cat = category.toLowerCase();

  let label = "Document";
  let colorClasses = RESOURCE_KIND_TONE.document.badge;

  if (cat.includes("repo") || cat === "repository") {
    label = "Repository";
    colorClasses = RESOURCE_KIND_TONE.repository.badge;
  } else if (cat.includes("figma")) {
    label = "Figma";
    colorClasses = RESOURCE_KIND_TONE.figma.badge;
  } else if (cat.includes("deploy") || cat === "deployment") {
    label = "Deployment";
    colorClasses = RESOURCE_KIND_TONE.deployment.badge;
  } else if (cat.includes("drive")) {
    label = "Google Drive";
    colorClasses = RESOURCE_KIND_TONE.drive.badge;
  } else if (cat.includes("record") || cat === "recording") {
    label = "Recording";
    colorClasses = RESOURCE_KIND_TONE.recording.badge;
  } else if (cat.includes("account") || cat.includes("credential")) {
    label = "Account";
    colorClasses = RESOURCE_KIND_TONE.account.badge;
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-12 font-semibold ${colorClasses}`}>
      {label}
    </span>
  );
}
