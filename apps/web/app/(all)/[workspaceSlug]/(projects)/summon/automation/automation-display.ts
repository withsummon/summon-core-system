/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { BookOpenIcon, FileTextIcon, PresentationIcon, TableIcon } from "@phosphor-icons/react";
import { BookOpen, FileCheck2, FileSpreadsheet, FileText, Presentation } from "lucide-react";
import type { TSelectableIcon } from "@plane/propel/icons";
import { renderFormattedDate } from "@plane/utils";
import type { ISummonAutomationJob, ISummonAutomationTemplate, ISummonGeneratedArtifact } from "@plane/types";

export const OUTPUT_FORMAT_LABELS: Record<ISummonGeneratedArtifact["format"], string> = {
  page: "Page",
  pdf: "PDF",
  docx: "DOCX",
  xlsx: "XLSX",
  pptx: "PPTX",
};

const templateOrder = [
  "proposal_client",
  "quotation",
  "mom_summon",
  "presentation",
  "cost_projection",
  "proposal_vendor",
];

export const templateLabel = (type: string) =>
  type
    .replace(/^proposal_(client|vendor)$/, "technical proposal")
    .replace(/^mom_(iglo|summon)$/, "minutes of meeting")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const templateTabIcon = (type: string): TSelectableIcon => {
  if (type === "quotation" || type === "cost_projection") return TableIcon;
  if (type.startsWith("mom_")) return BookOpenIcon;
  if (type === "presentation") return PresentationIcon;
  return FileTextIcon;
};

export const templateVisual = (type: string) => {
  if (type === "quotation") return { Icon: FileSpreadsheet, tone: "bg-label-emerald-bg text-label-emerald-icon" };
  if (type.startsWith("mom_")) return { Icon: BookOpen, tone: "bg-label-purple-bg text-label-purple-icon" };
  if (type === "presentation") return { Icon: Presentation, tone: "bg-label-orange-bg text-label-orange-icon" };
  if (type === "cost_projection") return { Icon: FileSpreadsheet, tone: "bg-label-yellow-bg text-label-yellow-icon" };
  if (type.includes("proposal")) return { Icon: FileText, tone: "bg-label-indigo-bg text-label-indigo-icon" };
  return { Icon: FileCheck2, tone: "bg-label-grey-bg text-label-grey-icon" };
};

export const outputFormats = (type?: string) => {
  if (["presentation", "proposal_vendor", "proposal_client"].includes(type ?? "")) return ["pptx", "pdf"] as const;
  if (["usage_cost", "cost_projection", "timeline", "bug_report"].includes(type ?? "")) return ["xlsx", "pdf"] as const;
  return ["docx", "pdf"] as const;
};

// Pass a Date (not the ISO string) so the day is resolved in the viewer's timezone, as before.
export const formatDate = (value: string) => renderFormattedDate(new Date(value)) ?? "";

export const jobStatus = (job: ISummonAutomationJob) => {
  if (job.status === "completed")
    return {
      label: job.artifacts.length ? "Completed" : "Preview",
      className: "bg-success-subtle text-success-primary",
    };
  if (job.status === "failed") return { label: "Failed", className: "bg-danger-subtle text-danger-primary" };
  return {
    label: job.status === "running" ? "Running" : "Queued",
    className: "bg-warning-subtle text-warning-primary",
  };
};

export const orderedTemplates = (templates: ISummonAutomationTemplate[]) =>
  // eslint-disable-next-line unicorn/no-array-sort -- the app target does not include ES2023 Array#toSorted.
  [...templates].sort((left, right) => {
    const leftIndex = templateOrder.indexOf(left.type);
    const rightIndex = templateOrder.indexOf(right.type);
    return (
      (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex) || left.name.localeCompare(right.name)
    );
  });
