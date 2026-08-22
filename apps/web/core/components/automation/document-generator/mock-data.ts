/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { IGeneratedDocument, IRecentActivity, ITemplateItem } from "./types";

export const TOP_TEMPLATES: ITemplateItem[] = [
  {
    id: "template-tech-proposal",
    name: "Technical Proposal",
    title: "Technical Proposal",
    description: "Generate comprehensive technical proposals with AI",
    iconType: "proposal",
    defaultFormat: "DOCX",
  },
  {
    id: "template-quotation",
    name: "Quotation",
    title: "Quotation",
    description: "Create detailed quotation with cost breakdown",
    iconType: "quotation",
    defaultFormat: "PDF",
  },
  {
    id: "template-mom",
    name: "MoM",
    title: "MoM",
    description: "Generate Minutes of Meeting from discussions",
    iconType: "mom",
    defaultFormat: "DOCX",
  },
  {
    id: "template-presentation",
    name: "Presentation",
    title: "Presentation (PPT)",
    description: "Create professional presentations in minutes",
    iconType: "presentation",
    defaultFormat: "PPTX",
  },
  {
    id: "template-cost-projection",
    name: "Cost Projection",
    title: "Cost Projection",
    description: "Generate cost projection and financial analysis",
    iconType: "cost",
    defaultFormat: "DOCX",
  },
  {
    id: "template-architecture-brief",
    name: "POC Brief",
    title: "Architecture / POC Brief",
    description: "Create architecture design or POC brief",
    iconType: "poc",
    defaultFormat: "PDF",
  },
];

export const INITIAL_GENERATED_DOCUMENTS: IGeneratedDocument[] = [
  {
    id: "doc-1",
    title: "Technical Proposal - BSB LMS v1.0",
    description: "Proposal for core system development",
    type: "Technical Proposal",
    context: "BSB Logistic Management System",
    createdBy: {
      name: "Fikri Adriansyah",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
      initials: "FA",
    },
    createdAt: "Today at 10:30",
    status: "Completed",
    format: "DOCX",
    content: `# Technical Proposal - BSB LMS v1.0
## Executive Summary
This document provides a comprehensive technical proposal for the design, architecture, and deployment of the BSB Logistic Management System (BSB LMS v1.0).

## 1. System Architecture
- Microservices-based modular infrastructure
- Real-time fleet tracking and telemetry ingestion pipeline
- Automated route optimization using genetic algorithms and Dijkstra's graph traversal
- High-availability PostgreSQL database cluster with read-replicas and Redis caching tier

## 2. Security & Compliance
- End-to-end TLS encryption in transit and AES-256 at rest
- Role-Based Access Control (RBAC) supporting granular logistics operational levels
- ISO 27001 and SOC 2 Type II compliance readiness

## 3. Implementation Roadmap
- Phase 1: Core Logistics Engine & Fleet Database (Weeks 1-4)
- Phase 2: AI Route Planner & Dispatch Dispatcher (Weeks 5-8)
- Phase 3: Mobile Driver Companion & Telematics Gateway (Weeks 9-12)
- Phase 4: User Acceptance Testing & Production Cutover (Weeks 13-14)`,
  },
  {
    id: "doc-2",
    title: "Quotation - BSB LMS v1.0",
    description: "Commercial quotation with cost breakdown",
    type: "Quotation",
    context: "BSB Logistic Management System",
    createdBy: {
      name: "Muhammad Arief",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
      initials: "MA",
    },
    createdAt: "Today at 09:15",
    status: "Completed",
    format: "PDF",
    content: `# Commercial Quotation - BSB LMS v1.0
**Client:** PT Bangun Sarana Bersama (BSB)
**Date:** Today, 09:15 AM
**Quotation Ref:** QTN-2025-08-BSB-001

### Itemized Scope of Work
1. **Core Logistics Backend & APIs**: $24,500.00
2. **AI-Driven Route Optimization Engine**: $18,000.00
3. **Driver Mobile App (iOS & Android)**: $16,500.00
4. **Operations Web Dashboard**: $14,000.00
5. **Deployment, CI/CD & Cloud Setup**: $6,000.00
6. **Support & Maintenance (12 Months SLA)**: $12,000.00

---
**Total Project Investment:** $91,000.00 USD
*Payment Terms: 30% Down Payment, 40% Milestone Deliverables, 30% Final Handover.*`,
  },
  {
    id: "doc-3",
    title: "MoM - Internal Review Meeting",
    description: "Minutes of internal review meeting",
    type: "MoM",
    context: "BSB Logistic Management System",
    createdBy: {
      name: "Wibi Susanto",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
      initials: "WS",
    },
    createdAt: "Yesterday at 16:45",
    status: "Completed",
    format: "DOCX",
    content: `# Minutes of Meeting: Internal Technical Review
**Project:** BSB Logistic Management System
**Attendees:** Fikri Adriansyah, Muhammad Arief, Wibi Susanto, Rafael Lorenzo
**Time:** Yesterday at 16:45

### Agenda
1. Review sprint deliverables for LMS microservices architecture.
2. Address third-party GPS telematics API latency issues.
3. Review staging deployment timeline and client milestone presentation.

### Decisions & Action Items
- **Muhammad Arief** to implement a Redis buffering queue for high-frequency GPS telemetry packets.
- **Rafael Lorenzo** to finalize the presentation deck by Wednesday afternoon.
- **Fikri Adriansyah** to lead the architecture sign-off meeting with stakeholder team.`,
  },
  {
    id: "doc-4",
    title: "Presentation - BSB LMS Overview",
    description: "Executive presentation deck",
    type: "Presentation",
    context: "BSB Logistic Management System",
    createdBy: {
      name: "Rafael Lorenzo",
      avatar: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=100&auto=format&fit=crop&q=80",
      initials: "RL",
    },
    createdAt: "Yesterday at 14:20",
    status: "Completed",
    format: "PPTX",
    content: `# Presentation: BSB LMS Overview
*Slide Deck Outline (12 Slides)*

- **Slide 1:** Title: Transforming Modern Logistics with AI
- **Slide 2:** Current Industry Challenges & Cost Inefficiencies
- **Slide 3:** The BSB LMS Solution & Platform Vision
- **Slide 4:** High-Level Architecture & Scalability
- **Slide 5:** Real-time Dispatch & Dynamic Routing Engine
- **Slide 6:** Driver App & Operations Command Center
- **Slide 7:** Business Impact: 28% Delivery Time Reduction
- **Slide 8:** Timeline & Sprint Milestones
- **Slide 9:** Security, SLA & Uptime Guarantees
- **Slide 10:** Investment & Financial Return Analysis
- **Slide 11:** Client Testimonials & Case Studies
- **Slide 12:** Q&A and Next Steps`,
  },
  {
    id: "doc-5",
    title: "Cost Projection - BSB LMS",
    description: "5 years cost projection and ROI analysis",
    type: "Cost Projection",
    context: "BSB Logistic Management System",
    createdBy: {
      name: "Fikri Adriansyah",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
      initials: "FA",
    },
    createdAt: "23 Aug 2025",
    status: "Completed",
    format: "DOCX",
    content: `# 5-Year Cost Projection & Financial ROI Analysis
**Project:** BSB Logistic Management System

### Summary Table (in USD)
- **Year 1 (Capex + Opex):** $115,000 (Initial build + infrastructure)
- **Year 2 (Opex & Support):** $28,000 (Cloud hosting + maintenance)
- **Year 3 (Opex & Optimization):** $31,000
- **Year 4 (Opex & Scaled Fleet):** $34,500
- **Year 5 (Opex):** $38,000

**Projected 5-Year Operational Savings:** $420,000
**Net ROI:** 172.5% over 5 years.`,
  },
  {
    id: "doc-6",
    title: "Architecture Brief - BSB LMS",
    description: "High level architecture and components",
    type: "POC Brief",
    context: "BSB Logistic Management System",
    createdBy: {
      name: "Muhammad Arief",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
      initials: "MA",
    },
    createdAt: "22 Aug 2025",
    status: "Completed",
    format: "PDF",
    content: `# High-Level Architecture & POC Brief
**Scope:** Proof of Concept Architecture Validation

### Key Architectural Pillars
1. **API Gateway & Traffic Routing:** Kong API Gateway with rate limiting and JWT verification.
2. **Event Streaming:** Apache Kafka for high-throughput vehicle event processing.
3. **Core Services:** Go & Node.js microservices deployed on AWS EKS Kubernetes clusters.
4. **Data Persistence:** PostgreSQL with TimescaleDB extension for time-series geospatial telemetry.`,
  },
  {
    id: "doc-7",
    title: "Technical Proposal - SANFIND Enhancement",
    description: "Enhancement for SBF check period relay",
    type: "Technical Proposal",
    context: "SANFIND Enhancement",
    createdBy: {
      name: "Wibi Susanto",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
      initials: "WS",
    },
    createdAt: "20 Aug 2025",
    status: "Draft",
    format: "DOCX",
    content: `# Technical Proposal - SANFIND Enhancement
## Objective
Upgrade the SBF check period relay mechanism to optimize heartbeat intervals and reduce network overhead across regional sensor gateways.`,
  },
  {
    id: "doc-8",
    title: "Quotation - SANFIND Enhancement",
    description: "Commercial for enhancement project",
    type: "Quotation",
    context: "SANFIND Enhancement",
    createdBy: {
      name: "Rafael Lorenzo",
      avatar: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=100&auto=format&fit=crop&q=80",
      initials: "RL",
    },
    createdAt: "20 Aug 2025",
    status: "Draft",
    format: "PDF",
    content: `# Commercial Quotation - SANFIND Enhancement
**Total Estimate:** $18,500.00
**Duration:** 3 Weeks engineering sprint with QA sign-off.`,
  },
];

export const TEMPLATE_LIBRARY: ITemplateItem[] = [
  {
    id: "lib-1",
    name: "Technical Proposal",
    title: "Technical Proposal",
    description: "Best for system development proposals",
    iconType: "proposal",
    lastUsed: "Last used 2 days ago",
  },
  {
    id: "lib-2",
    name: "Quotation",
    title: "Quotation",
    description: "Best for commercial proposals",
    iconType: "quotation",
    lastUsed: "Last used today",
  },
  {
    id: "lib-3",
    name: "MoM",
    title: "MoM",
    description: "Best for meeting documentation",
    iconType: "mom",
    lastUsed: "Last used yesterday",
  },
  {
    id: "lib-4",
    name: "Presentation",
    title: "Presentation",
    description: "Best for executive presentations",
    iconType: "presentation",
    lastUsed: "Last used 2 days ago",
  },
];

export const RECENT_ACTIVITIES: IRecentActivity[] = [
  {
    id: "act-1",
    title: "Technical Proposal - BSB LMS v1.0 generated",
    author: "by Fikri Adriansyah • 10:30 AM",
    timestamp: "10:30 AM",
    color: "green",
  },
  {
    id: "act-2",
    title: "MoM - Internal Review Meeting generated",
    author: "by Wibi Susanto • Yesterday 04:45 PM",
    timestamp: "Yesterday 04:45 PM",
    color: "purple",
  },
  {
    id: "act-3",
    title: "Cost Projection - BSB LMS generated",
    author: "by Fikri Adriansyah • 23 Aug 2025",
    timestamp: "23 Aug 2025",
    color: "cyan",
  },
  {
    id: "act-4",
    title: "Architecture Brief - BSB LMS generated",
    author: "by Muhammad Arief • 22 Aug 2025",
    timestamp: "22 Aug 2025",
    color: "purple",
  },
];

export const AVAILABLE_CONTEXTS = [
  "BSB Logistic Management System",
  "SANFIND Enhancement",
  "Summon Platform Core v2",
  "Internal Review & QA System",
  "Enterprise Billing Automation",
];
