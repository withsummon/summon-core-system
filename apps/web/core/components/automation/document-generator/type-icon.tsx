/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import {
  FileText,
  FileSpreadsheet,
  BookOpen,
  Presentation,
  TrendingUp,
  Layers,
  FileCode,
} from "lucide-react";
import { cn } from "@plane/utils";
import type { TDocumentType } from "./types";

interface ITypeIconProps {
  type: TDocumentType | string;
  className?: string;
  size?: number;
  boxed?: boolean;
}

export const getDocumentTypeTheme = (type: TDocumentType | string) => {
  switch (type) {
    case "Technical Proposal":
      return {
        icon: FileText,
        textColor: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-50 dark:bg-blue-950/40",
        borderColor: "border-blue-200 dark:border-blue-800/60",
        badgeBg: "bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/60",
      };
    case "Quotation":
      return {
        icon: FileSpreadsheet,
        textColor: "text-emerald-600 dark:text-emerald-400",
        bgColor: "bg-emerald-50 dark:bg-emerald-950/40",
        borderColor: "border-emerald-200 dark:border-emerald-800/60",
        badgeBg: "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60",
      };
    case "MoM":
      return {
        icon: BookOpen,
        textColor: "text-purple-600 dark:text-purple-400",
        bgColor: "bg-purple-50 dark:bg-purple-950/40",
        borderColor: "border-purple-200 dark:border-purple-800/60",
        badgeBg: "bg-purple-50 text-purple-600 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800/60",
      };
    case "Presentation":
      return {
        icon: Presentation,
        textColor: "text-orange-600 dark:text-orange-400",
        bgColor: "bg-orange-50 dark:bg-orange-950/40",
        borderColor: "border-orange-200 dark:border-orange-800/60",
        badgeBg: "bg-orange-50 text-orange-600 border border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800/60",
      };
    case "Cost Projection":
      return {
        icon: TrendingUp,
        textColor: "text-cyan-600 dark:text-cyan-400",
        bgColor: "bg-cyan-50 dark:bg-cyan-950/40",
        borderColor: "border-cyan-200 dark:border-cyan-800/60",
        badgeBg: "bg-cyan-50 text-cyan-600 border border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-800/60",
      };
    case "POC Brief":
    case "Architecture / POC Brief":
      return {
        icon: Layers,
        textColor: "text-purple-600 dark:text-purple-400",
        bgColor: "bg-purple-50 dark:bg-purple-950/40",
        borderColor: "border-purple-200 dark:border-purple-800/60",
        badgeBg: "bg-purple-50 text-purple-600 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800/60",
      };
    default:
      return {
        icon: FileCode,
        textColor: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-50 dark:bg-blue-950/40",
        borderColor: "border-blue-200 dark:border-blue-800/60",
        badgeBg: "bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/60",
      };
  }
};

export const TypeIcon: React.FC<ITypeIconProps> = ({
  type,
  className,
  size = 18,
  boxed = false,
}) => {
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
