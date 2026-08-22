/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TDocumentFormat = "DOCX" | "PDF" | "PPTX";

export type TDocumentTone = "Professional" | "Casual" | "Formal" | "Technical" | "Executive";

export type TDetailLevel = "Concise" | "Standard" | "Comprehensive" | "In-depth";

export type TDocumentType =
  | "Technical Proposal"
  | "Quotation"
  | "MoM"
  | "Presentation"
  | "Cost Projection"
  | "POC Brief";

export type TDocumentStatus = "Completed" | "Draft" | "Generating";

export interface ITemplateItem {
  id: string;
  name: TDocumentType;
  title: string;
  description: string;
  iconType: "proposal" | "quotation" | "mom" | "presentation" | "cost" | "poc";
  bestFor?: string;
  lastUsed?: string;
  defaultFormat?: TDocumentFormat;
}

export interface IGeneratedDocument {
  id: string;
  title: string;
  description: string;
  type: TDocumentType;
  context: string;
  createdBy: {
    name: string;
    avatar?: string;
    initials: string;
  };
  createdAt: string;
  status: TDocumentStatus;
  format?: TDocumentFormat;
  content?: string;
}

export interface IRecentActivity {
  id: string;
  title: string;
  author: string;
  timestamp: string;
  color: "green" | "purple" | "cyan" | "orange" | "blue";
}

export interface IDocumentGeneratorFormData {
  template: TDocumentType;
  context: string;
  additionalContext: string;
  format: TDocumentFormat;
  tone: TDocumentTone;
  detailLevel: TDetailLevel;
}
