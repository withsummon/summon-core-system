/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { FileText, FileSpreadsheet, BookOpen, Presentation, TrendingUp, Layers, FileCode } from "lucide-react";
import { cn } from "@plane/utils";
import type { TDocumentType } from "./types";

interface ITypeIconProps {
  type: TDocumentType | string;
  className?: string;
  size?: number;
  boxed?: boolean;
}

// Class names stay literal so Tailwind can find them.
const LABEL_THEMES = {
  indigo: {
    textColor: "text-label-indigo-text",
    bgColor: "bg-label-indigo-bg",
    borderColor: "border-label-indigo-border",
    badgeBg: "bg-label-indigo-bg text-label-indigo-text border border-label-indigo-border",
  },
  emerald: {
    textColor: "text-label-emerald-text",
    bgColor: "bg-label-emerald-bg",
    borderColor: "border-label-emerald-border",
    badgeBg: "bg-label-emerald-bg text-label-emerald-text border border-label-emerald-border",
  },
  purple: {
    textColor: "text-label-purple-text",
    bgColor: "bg-label-purple-bg",
    borderColor: "border-label-purple-border",
    badgeBg: "bg-label-purple-bg text-label-purple-text border border-label-purple-border",
  },
  orange: {
    textColor: "text-label-orange-text",
    bgColor: "bg-label-orange-bg",
    borderColor: "border-label-orange-border",
    badgeBg: "bg-label-orange-bg text-label-orange-text border border-label-orange-border",
  },
  yellow: {
    textColor: "text-label-yellow-text",
    bgColor: "bg-label-yellow-bg",
    borderColor: "border-label-yellow-border",
    badgeBg: "bg-label-yellow-bg text-label-yellow-text border border-label-yellow-border",
  },
  pink: {
    textColor: "text-label-pink-text",
    bgColor: "bg-label-pink-bg",
    borderColor: "border-label-pink-border",
    badgeBg: "bg-label-pink-bg text-label-pink-text border border-label-pink-border",
  },
  grey: {
    textColor: "text-label-grey-text",
    bgColor: "bg-label-grey-bg",
    borderColor: "border-label-grey-border",
    badgeBg: "bg-label-grey-bg text-label-grey-text border border-label-grey-border",
  },
} as const;

export const getDocumentTypeTheme = (type: TDocumentType | string) => {
  switch (type) {
    case "Technical Proposal":
      return { icon: FileText, ...LABEL_THEMES.indigo };
    case "Quotation":
      return { icon: FileSpreadsheet, ...LABEL_THEMES.emerald };
    case "MoM":
      return { icon: BookOpen, ...LABEL_THEMES.purple };
    case "Presentation":
      return { icon: Presentation, ...LABEL_THEMES.orange };
    case "Cost Projection":
      return { icon: TrendingUp, ...LABEL_THEMES.yellow };
    case "POC Brief":
    case "Architecture / POC Brief":
      return { icon: Layers, ...LABEL_THEMES.pink };
    default:
      return { icon: FileCode, ...LABEL_THEMES.grey };
  }
};

export const TypeIcon: React.FC<ITypeIconProps> = ({ type, className, size = 18, boxed = false }) => {
  const theme = getDocumentTypeTheme(type);
  const IconComponent = theme.icon;

  if (boxed) {
    return (
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg border",
          theme.bgColor,
          theme.borderColor,
          theme.textColor,
          className
        )}
      >
        <IconComponent size={size} strokeWidth={2} />
      </div>
    );
  }

  return <IconComponent size={size} strokeWidth={2} className={cn(theme.textColor, className)} />;
};
