/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TReportingTab =
  | "Overview"
  | "Company Progress"
  | "Project Health"
  | "Pipeline"
  | "Investment Disbursement"
  | "Portfolio / Client Database";

export interface IReportingKpiItem {
  id: string;
  label: string;
  value: string;
  change: string;
  isPositive: boolean;
  subtext?: string;
  type: "revenue" | "projects" | "opportunities" | "health" | "tasks";
}

export interface ICompanyProgressBreakdown {
  label: string;
  valueIdr: string;
  percentage: number;
  color: string;
}

export interface IProjectHealthItem {
  name: string;
  score: number;
  status: "critical" | "at_risk" | "good" | "excellent";
}

export interface IPipelineStage {
  stage: string;
  valueIdr: string;
  percentage: number;
  color: string;
}

export interface IDisbursementItem {
  id: string;
  project: string;
  client: string;
  totalInvestment: string;
  disbursed: string;
  progress: number;
  nextDisbursement: string;
}

export interface ITopClientRevenue {
  client: string;
  revenue: string;
  contribution: string;
}

export interface IRecentReportItem {
  id: string;
  title: string;
  period: string;
  format: "PDF" | "XLSX" | "DOCX" | "PPTX";
  badgeColor: "red" | "blue" | "green" | "purple" | "cyan";
  downloadUrl?: string;
}

export type TDocumentTemplateType =
  | "mom_iglo"
  | "mom_summon"
  | "ppt_vendor_proposal"
  | "client_technical_proposal"
  | "quotation"
  | "project_timeline"
  | "usage_cost_projection"
  | "bast"
  | "uat"
  | "bug_report";

export interface IDocumentTemplate {
  id: TDocumentTemplateType;
  name: string;
  category: "Meeting" | "Proposal" | "Commercial" | "Planning" | "Handover" | "QA & Defects";
  description: string;
  format: "DOCX" | "PDF" | "PPTX" | "XLSX";
  sampleTitle: string;
  sections: string[];
  fields: Array<{
    key: string;
    label: string;
    type: "text" | "textarea" | "date" | "number" | "select";
    placeholder?: string;
    options?: string[];
  }>;
}
