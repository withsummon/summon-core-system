/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type {
  IReportingKpiItem,
  ICompanyProgressBreakdown,
  IProjectHealthItem,
  IPipelineStage,
  IDisbursementItem,
  ITopClientRevenue,
  IRecentReportItem,
  IDocumentTemplate,
} from "./types";

export const REPORTING_KPIS: IReportingKpiItem[] = [
  {
    id: "revenue",
    label: "Total Revenue (YTD)",
    value: "IDR 24.8B",
    change: "+18.6% vs last year",
    isPositive: true,
    type: "revenue",
  },
  {
    id: "active_projects",
    label: "Active Projects",
    value: "32",
    change: "+6 vs last month",
    isPositive: true,
    type: "projects",
  },
  {
    id: "open_opportunities",
    label: "Open Opportunities",
    value: "18",
    change: "",
    isPositive: true,
    subtext: "IDR 37.6B potential value",
    type: "opportunities",
  },
  {
    id: "project_health",
    label: "Project Health (Avg)",
    value: "78/100",
    change: "",
    isPositive: true,
    subtext: "Good",
    type: "health",
  },
  {
    id: "overdue_tasks",
    label: "Overdue Tasks",
    value: "27",
    change: "-12 vs last month",
    isPositive: false,
    type: "tasks",
  },
];

export const COMPANY_PROGRESS_BREAKDOWN: ICompanyProgressBreakdown[] = [
  { label: "On Track", valueIdr: "IDR 17.8B", percentage: 72, color: "#3B82F6" },
  { label: "At Risk", valueIdr: "IDR 4.6B", percentage: 18, color: "#6366F1" },
  { label: "Delayed", valueIdr: "IDR 1.9B", percentage: 8, color: "#06B6D4" },
  { label: "Not Started", valueIdr: "IDR 0.5B", percentage: 2, color: "#94A3B8" },
];

export const PROJECT_HEALTH_DISTRIBUTION = [
  { label: "Excellent (80–100)", count: 11, percentage: 34, color: "#10B981" },
  { label: "Good (60–79)", count: 13, percentage: 41, color: "#3B82F6" },
  { label: "At Risk (40–59)", count: 6, percentage: 19, color: "#F59E0B" },
  { label: "Critical (0–39)", count: 2, percentage: 6, color: "#EF4444" },
];

export const TOP_ATTENTION_PROJECTS: IProjectHealthItem[] = [
  { name: "BSB Core Banking System", score: 32, status: "critical" },
  { name: "SANFIND Enhancement", score: 45, status: "at_risk" },
  { name: "AI Interviewer Platform", score: 52, status: "at_risk" },
];

export const PIPELINE_STAGES: IPipelineStage[] = [
  { stage: "Prospecting", valueIdr: "IDR 12.4B", percentage: 26, color: "#93C5FD" },
  { stage: "Qualification", valueIdr: "IDR 8.7B", percentage: 20, color: "#60A5FA" },
  { stage: "Proposal", valueIdr: "IDR 7.6B", percentage: 18, color: "#3B82F6" },
  { stage: "Negotiation", valueIdr: "IDR 5.9B", percentage: 14, color: "#2563EB" },
  { stage: "Closed Won", valueIdr: "IDR 3.0B", percentage: 7, color: "#10B981" },
  { stage: "Closed Lost", valueIdr: "IDR 0.8B", percentage: 3, color: "#F87171" },
];

export const DISBURSEMENT_PROGRESS: IDisbursementItem[] = [
  {
    id: "disb-1",
    project: "BSB Core Banking System",
    client: "Bank Sinar Bahana",
    totalInvestment: "IDR 12.5B",
    disbursed: "IDR 8.1B",
    progress: 65,
    nextDisbursement: "15 Jun 2025",
  },
  {
    id: "disb-2",
    project: "AI Interviewer Platform",
    client: "Pegadaian",
    totalInvestment: "IDR 6.1B",
    disbursed: "IDR 4.2B",
    progress: 62,
    nextDisbursement: "10 Jun 2025",
  },
  {
    id: "disb-3",
    project: "SANFIND Enhancement",
    client: "SANFIND",
    totalInvestment: "IDR 4.2B",
    disbursed: "IDR 2.1B",
    progress: 50,
    nextDisbursement: "20 Jun 2025",
  },
  {
    id: "disb-4",
    project: "Mutiara Multifinance System",
    client: "Mutiara MF",
    totalInvestment: "IDR 3.6B",
    disbursed: "IDR 2.7B",
    progress: 75,
    nextDisbursement: "5 Jun 2025",
  },
  {
    id: "disb-5",
    project: "BSB Data Warehouse",
    client: "Bank Sinar Bahana",
    totalInvestment: "IDR 2.9B",
    disbursed: "IDR 1.7B",
    progress: 59,
    nextDisbursement: "15 Jun 2025",
  },
];

export const CLIENT_DATABASE_STATS = {
  totalClients: 28,
  totalClientsChange: "+2 vs last month",
  activeClients: 22,
  activeClientsPercent: "79% of total",
  newClientsYtd: 6,
  newClientsChange: "+2 vs last year",
  retentionRate: "91%",
  retentionBadge: "Excellent",
};

export const TOP_CLIENTS_REVENUE: ITopClientRevenue[] = [
  { client: "Bank Sinar Bahana", revenue: "8.9B", contribution: "35.9%" },
  { client: "Pegadaian", revenue: "5.6B", contribution: "22.6%" },
  { client: "SANFIND", revenue: "4.1B", contribution: "16.5%" },
  { client: "Mutiara Multifinance", revenue: "2.7B", contribution: "10.9%" },
  { client: "Other Clients", revenue: "3.5B", contribution: "14.1%" },
];

export const RECENT_REPORTS: IRecentReportItem[] = [
  {
    id: "rep-1",
    title: "Monthly Executive Report",
    period: "May 2025",
    format: "PDF",
    badgeColor: "red",
  },
  {
    id: "rep-2",
    title: "Project Health Report",
    period: "May 2025",
    format: "PDF",
    badgeColor: "blue",
  },
  {
    id: "rep-3",
    title: "Pipeline Report",
    period: "May 2025",
    format: "PDF",
    badgeColor: "purple",
  },
  {
    id: "rep-4",
    title: "Investment Disbursement Report",
    period: "May 2025",
    format: "XLSX",
    badgeColor: "green",
  },
  {
    id: "rep-5",
    title: "Client Performance Report",
    period: "May 2025",
    format: "PDF",
    badgeColor: "cyan",
  },
];

export const DOCUMENT_TEMPLATES: IDocumentTemplate[] = [
  {
    id: "mom_iglo",
    name: "MoM Format IGLO",
    category: "Meeting",
    description:
      "Standard IGLO structured Minutes of Meeting with attendees, agenda, key discussions, and action items table with PIC & Target dates.",
    format: "DOCX",
    sampleTitle: "MoM - Sprint Planning & Delivery Sync (IGLO)",
    sections: [
      "Meeting Header & Metadata",
      "Attendance & Roles",
      "Meeting Agenda",
      "Key Discussion Points",
      "Action Items Table (PIC & Target Date)",
    ],
    fields: [
      { key: "project_name", label: "Project Name", type: "text", placeholder: "e.g. Core Banking System" },
      { key: "date", label: "Meeting Date", type: "date" },
      { key: "organizer", label: "Organizer / Host", type: "text", placeholder: "e.g. Fikri Adriansyah" },
      {
        key: "attendees",
        label: "Attendees (Names & Roles)",
        type: "textarea",
        placeholder: "John Doe (PM), Jane Smith (Lead Dev), etc.",
      },
      {
        key: "agenda",
        label: "Meeting Agenda",
        type: "textarea",
        placeholder: "1. Review sprint progress\n2. Blockers discussion\n3. Next release target",
      },
      {
        key: "notes",
        label: "Key Discussions & Decisions",
        type: "textarea",
        placeholder: "Summary of discussion points and architectural decisions...",
      },
    ],
  },
  {
    id: "mom_summon",
    name: "MoM Format Summon",
    category: "Meeting",
    description:
      "Modern Summon Minutes of Meeting with executive AI summary, sentiment, decision matrices, and priority action items.",
    format: "DOCX",
    sampleTitle: "MoM - Executive Strategy & Stakeholder Review (Summon)",
    sections: [
      "Meeting Overview & Scope",
      "Stakeholder Alignment",
      "AI Key Takeaways",
      "Decision Matrix",
      "Priority Action Item Matrix",
    ],
    fields: [
      { key: "client_name", label: "Client Name", type: "text", placeholder: "e.g. PT Pegadaian (Persero)" },
      {
        key: "objective",
        label: "Meeting Objective",
        type: "text",
        placeholder: "e.g. Architecture Review & POC Kickoff",
      },
      {
        key: "decisions",
        label: "Key Decisions Made",
        type: "textarea",
        placeholder: "Agreed on microservices deployment on Kubernetes...",
      },
      {
        key: "actions",
        label: "Action Items & Assignees",
        type: "textarea",
        placeholder: "1. Prepare API documentation (Adi - 30 May)",
      },
    ],
  },
  {
    id: "ppt_vendor_proposal",
    name: "PPT Proposal Teknis Vendor",
    category: "Proposal",
    description:
      "High-impact Presentation Deck for Technical Vendor Proposals covering executive summary, tech stack, architecture, team, and pricing.",
    format: "PPTX",
    sampleTitle: "Proposal Teknis Vendor - AI-Powered Solution Stack",
    sections: [
      "Executive Summary",
      "Understanding of Client Needs",
      "Solution Architecture & Stack",
      "Scope of Work & Deliverables",
      "Team Structure & Governance",
      "Timeline & Milestones",
      "Commercials & SLA",
    ],
    fields: [
      { key: "client_target", label: "Target Client", type: "text", placeholder: "e.g. Bank Sinar Bahana" },
      {
        key: "solution_name",
        label: "Proposed Solution Name",
        type: "text",
        placeholder: "e.g. Enterprise AI Document & Workflow Platform",
      },
      { key: "duration_months", label: "Project Duration (Months)", type: "number", placeholder: "6" },
      {
        key: "tech_stack",
        label: "Primary Tech Stack",
        type: "text",
        placeholder: "React, Python/Django, Postgres, Redis, AWS",
      },
      {
        key: "executive_summary",
        label: "Executive Summary",
        type: "textarea",
        placeholder: "High-level summary of value proposition and ROI...",
      },
    ],
  },
  {
    id: "client_technical_proposal",
    name: "Proposal Teknis Klien",
    category: "Proposal",
    description:
      "In-depth Technical Proposal Document for enterprise clients detailing architectural blueprints, security, implementation methodology, and SLA.",
    format: "DOCX",
    sampleTitle: "Proposal Teknis Implementasi Sistem Core & Integrasi API",
    sections: [
      "Latar Belakang & Tujuan",
      "Ruang Lingkup Pekerjaan (In-Scope & Out-of-Scope)",
      "Arsitektur Sistem & Keamanan",
      "Metodologi Implementasi Agile",
      "Rencana Sumber Daya",
      "SLA & Garansi",
    ],
    fields: [
      { key: "title", label: "Proposal Title", type: "text", placeholder: "Proposal Teknis Sistem Manajemen" },
      { key: "client", label: "Client Organization", type: "text", placeholder: "e.g. PT Pegadaian (Persero)" },
      {
        key: "scope",
        label: "Ruang Lingkup (Scope)",
        type: "textarea",
        placeholder: "Detail modul, integrasi sistem, dan deployment...",
      },
      {
        key: "sla_terms",
        label: "SLA & Support Level",
        type: "text",
        placeholder: "99.9% Uptime, 24/7 Response Time < 15 min",
      },
    ],
  },
  {
    id: "quotation",
    name: "Quotation Commercial",
    category: "Commercial",
    description:
      "Official Commercial Quotation with itemized cost breakdown, licensing, professional services, payment terms, and validity.",
    format: "PDF",
    sampleTitle: "Official Quotation - Software Development & Cloud Setup",
    sections: [
      "Header & Quotation Number",
      "Bill To Client Info",
      "Itemized Cost Breakdown Table",
      "Subtotal, Tax (PPN 11%), Grand Total",
      "Payment Milestone Schedule",
      "Terms & Conditions",
    ],
    fields: [
      { key: "quote_number", label: "Quotation Number", type: "text", placeholder: "QUO/SUMMON/2025/05/001" },
      { key: "valid_until", label: "Valid Until", type: "date" },
      {
        key: "items_summary",
        label: "Deliverables & Pricing (Itemized)",
        type: "textarea",
        placeholder:
          "1. Core Platform Development - IDR 450,000,000\n2. Cloud Infra Setup - IDR 80,000,000\n3. Maintenance 1 Year - IDR 120,000,000",
      },
      {
        key: "payment_terms",
        label: "Payment Terms",
        type: "text",
        placeholder: "DP 30%, Milestone 1 40%, BAST Final 30%",
      },
    ],
  },
  {
    id: "project_timeline",
    name: "Timeline Project & Gantt",
    category: "Planning",
    description:
      "Comprehensive Gantt and Milestone schedule breaking down phases, sprint tasks, critical paths, dependencies, and go-live target.",
    format: "XLSX",
    sampleTitle: "Project Master Timeline & Sprint Schedule 2025",
    sections: [
      "Project Overview & Phases",
      "Sprint-by-Sprint Breakdown",
      "Milestones & Deliverables",
      "Resource Allocations",
      "Critical Path Dependencies",
    ],
    fields: [
      { key: "project_title", label: "Project Title", type: "text", placeholder: "e.g. AI Interviewer Platform" },
      { key: "start_date", label: "Start Date", type: "date" },
      { key: "end_date", label: "Go-Live Target Date", type: "date" },
      {
        key: "phases",
        label: "Project Phases & Sprints",
        type: "textarea",
        placeholder: "Phase 1: Discovery (Week 1-2)\nPhase 2: Core Dev (Week 3-10)\nPhase 3: QA & UAT (Week 11-12)",
      },
    ],
  },
  {
    id: "usage_cost_projection",
    name: "Usage Cost Projection",
    category: "Planning",
    description:
      "Spreadsheet projection for Cloud & AI Infrastructure costs covering compute, storage, token inference, monthly OpEx, and ROI forecast.",
    format: "XLSX",
    sampleTitle: "Infrastructure & LLM Token Cost Projection Model",
    sections: [
      "Cost Assumptions & User Tiers",
      "Compute & Database Expenses",
      "Storage & CDN Network Costs",
      "AI / LLM API Token Cost Forecast",
      "12-Month OpEx Projections & ROI",
    ],
    fields: [
      { key: "monthly_active_users", label: "Estimated Monthly Active Users", type: "number", placeholder: "50000" },
      { key: "ai_token_volume", label: "Estimated AI Tokens / Month (Millions)", type: "number", placeholder: "25" },
      {
        key: "infra_provider",
        label: "Cloud Provider",
        type: "select",
        options: ["AWS", "Google Cloud", "Azure", "On-Premises Hybrid"],
      },
      {
        key: "notes",
        label: "Assumptions & Growth Rate",
        type: "textarea",
        placeholder: "Assumes 15% month-over-month growth...",
      },
    ],
  },
  {
    id: "bast",
    name: "BAST (Berita Acara Serah Terima)",
    category: "Handover",
    description:
      "Official Handover Document (Berita Acara Serah Terima) for formal project completion, acceptance confirmation, and warranty initiation.",
    format: "DOCX",
    sampleTitle: "Berita Acara Serah Terima Hasil Pekerjaan (BAST)",
    sections: [
      "Nomor Surat & Tanggal BAST",
      "Identitas Pihak Pertama (Penyedia) & Pihak Kedua (Klien)",
      "Dasar Kontrak Perjanjian",
      "Daftar Hasil Pekerjaan yang Diserahterimakan",
      "Pernyataan Penerimaan & Masa Garansi",
      "Lembar Pengesahan Tanda Tangan",
    ],
    fields: [
      { key: "bast_number", label: "Nomor BAST", type: "text", placeholder: "014/BAST-SUMMON/V/2025" },
      { key: "contract_ref", label: "Nomor SPK / Kontrak", type: "text", placeholder: "SPK-089/CORP/IV/2025" },
      {
        key: "client_signee",
        label: "Pejabat Penandatangan Klien",
        type: "text",
        placeholder: "Budi Santoso (VP Technology)",
      },
      {
        key: "vendor_signee",
        label: "Pejabat Penandatangan Vendor",
        type: "text",
        placeholder: "Rafael Lorenzo (Managing Director)",
      },
      {
        key: "deliverables_list",
        label: "Rincian Deliverables",
        type: "textarea",
        placeholder:
          "1. Source Code & Repository Access\n2. Production Deployment & Config\n3. User Manual & API Docs\n4. Laporan UAT Signed",
      },
    ],
  },
  {
    id: "uat",
    name: "UAT (User Acceptance Testing)",
    category: "QA & Defects",
    description:
      "Structured UAT Script with Test Case Matrix, Expected vs Actual Results, Pass/Fail status, Defect logging, and Sign-off authorization.",
    format: "DOCX",
    sampleTitle: "User Acceptance Testing (UAT) Execution & Sign-Off Document",
    sections: [
      "UAT Objectives & Scope",
      "Testing Environment Details",
      "Test Case Execution Matrix (Pass/Fail)",
      "Defect & Issue Log",
      "UAT Sign-off & Final Approval",
    ],
    fields: [
      {
        key: "system_name",
        label: "System / Feature Under Test",
        type: "text",
        placeholder: "AI Interviewer & Candidate Scoring Engine",
      },
      { key: "tester_name", label: "Lead UAT Tester", type: "text", placeholder: "Citra Lestari" },
      { key: "test_period", label: "Testing Period", type: "text", placeholder: "15 May 2025 - 22 May 2025" },
      {
        key: "test_scenarios",
        label: "Test Scenarios List",
        type: "textarea",
        placeholder:
          "TC-01: User Login & Role Auth (PASS)\nTC-02: Video Upload & Transcribe (PASS)\nTC-03: Score Generation (PASS)\nTC-04: PDF Export (PASS)",
      },
    ],
  },
  {
    id: "bug_report",
    name: "Bug Report & Issue Tracker",
    category: "QA & Defects",
    description:
      "Detailed Bug Tracker spreadsheet logging Issue IDs, Severity, Module, Reproduction Steps, Developer Assigned, Root Cause, and Status.",
    format: "XLSX",
    sampleTitle: "QA Defect Tracking & Bug Resolution Log",
    sections: [
      "Defect Metrics Summary",
      "Severity Distribution Chart",
      "Detailed Bug Log Table",
      "Root Cause Analysis",
      "Resolution & Verification Status",
    ],
    fields: [
      { key: "project_name", label: "Project Name", type: "text", placeholder: "BSB Core Banking System" },
      { key: "sprint_version", label: "Sprint / Release Version", type: "text", placeholder: "Release v2.4.0-rc1" },
      {
        key: "bugs_summary",
        label: "Issue List & Severity",
        type: "textarea",
        placeholder:
          "BUG-101 [Critical]: Token timeout on large batch\nBUG-102 [Medium]: Date picker localization error\nBUG-103 [Low]: Button alignment on mobile",
      },
    ],
  },
];
