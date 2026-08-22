/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type {
  IKnowledgeContextCard,
  IKnowledgeItem,
  IKnowledgeStats,
  IPopularKnowledgeItem,
  IRecentNote,
} from "./types";

export const KNOWLEDGE_CONTEXT_CARDS: IKnowledgeContextCard[] = [
  {
    id: "ctx-projects",
    name: "Projects",
    title: "Projects",
    count: 87,
    description: "Project documentation, plans, and technical knowledge",
    iconType: "projects",
  },
  {
    id: "ctx-clients",
    name: "Clients",
    title: "Clients",
    count: 42,
    description: "Client information, requirements, and communication",
    iconType: "clients",
  },
  {
    id: "ctx-opportunities",
    name: "Opportunities",
    title: "Opportunities",
    count: 31,
    description: "Proposals, POC, and opportunity-related knowledge",
    iconType: "opportunities",
  },
  {
    id: "ctx-processes",
    name: "Processes",
    title: "Processes",
    count: 28,
    description: "Standard operating procedures and workflows",
    iconType: "processes",
  },
  {
    id: "ctx-company",
    name: "Company",
    title: "Company",
    count: 19,
    description: "Company policies, guidelines and general knowledge",
    iconType: "company",
  },
];

export const INITIAL_KNOWLEDGE_ITEMS: IKnowledgeItem[] = [
  {
    id: "kn-1",
    title: "Architecture Overview – BSB Logistic System",
    description: "High level architecture and component diagram for BSB system.",
    context: "BSB Logistic Management System",
    type: "Document",
    updatedAt: "2 hours ago",
    updatedBy: {
      name: "Fikri Adriansyah",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
      initials: "FA",
    },
    views: 234,
    tags: ["architecture", "backend", "system-design"],
    content: `# Architecture Overview – BSB Logistic System

## Overview
The BSB Logistic Management System (BSB LMS) is an enterprise cloud architecture built for real-time dispatch, routing optimization, and IoT fleet telematics.

### Core Architectural Layers
1. **Edge & Ingress Layer**: Managed AWS CloudFront CDN with Cloudflare WAF protection and TLS 1.3 termination.
2. **API & Service Mesh Layer**: Kong API Gateway running over private VPC subnets with Envoy proxy sidecars.
3. **Application Services**:
   - Dispatch & Trip Management (Golang)
   - Telemetry Streaming Engine (Node.js & Kafka)
   - Route Optimization AI Worker (Python Fast-API + OR-Tools)
4. **Data Persistence Layer**:
   - Multi-AZ PostgreSQL 16 with TimescaleDB geospatial extension
   - Redis Cluster for hot vehicle GPS coordinate caching
   - AWS S3 bucket for driver document uploads and BOL scans.`,
  },
  {
    id: "kn-2",
    title: "UAT Findings – SANFIND Enhancement",
    description: "Summary of UAT findings and action items.",
    context: "SANFIND Enhancement",
    type: "Note",
    updatedAt: "5 hours ago",
    updatedBy: {
      name: "Muhammad Arief",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
      initials: "MA",
    },
    views: 112,
    tags: ["uat", "qa", "sanfind"],
    content: `# UAT Findings – SANFIND Enhancement

### Summary
During the sprint 14 user acceptance testing (UAT), 12 test cases were evaluated across staging environments.

### Key Observations
- **Relay latency**: Gateway heartbeat packet delay reduced from 840ms to 120ms after Redis pipeline optimization.
- **Failover behavior**: Regional sensor node fallback successfully reconnected within 3 seconds of network disruption.
- **Action Item**: Muhammad Arief to update client staging documentation before tomorrow morning release.`,
  },
  {
    id: "kn-3",
    title: "MoM Template – Internal Meeting",
    description: "Standard MoM template for internal project meetings.",
    context: "Company",
    type: "Template",
    updatedAt: "1 day ago",
    updatedBy: {
      name: "Wibi Susanto",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
      initials: "WS",
    },
    views: 156,
    tags: ["template", "mom", "meeting"],
    content: `# Standard Minutes of Meeting (MoM) Template

**Meeting Title:** [Enter Title Here]
**Date & Time:** [Date] | [Time]
**Organizer:** [Organizer Name]
**Attendees:** [List of participants]

---

### 1. Meeting Objectives
- Objective 1
- Objective 2

### 2. Discussion Points & Key Decisions
- **Topic A:** Discussion summary and conclusion.
- **Topic B:** Key architectural or business decision agreed.

### 3. Action Items & Ownership
| Task | Assignee | Due Date | Status |
| :--- | :--- | :--- | :--- |
| Action item 1 | Name | Date | Open |
| Action item 2 | Name | Date | Open |`,
  },
  {
    id: "kn-4",
    title: "Lessons Learned – AURA Project",
    description: "Key takeaways and lessons learned from AURA project.",
    context: "AURA",
    type: "Lesson Learned",
    updatedAt: "2 days ago",
    updatedBy: {
      name: "Rafael Lorenzo",
      avatar: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=100&auto=format&fit=crop&q=80",
      initials: "RL",
    },
    views: 89,
    tags: ["retrospective", "aura", "best-practices"],
    content: `# Lessons Learned – AURA Project Retrospective

### What Went Well
- Early schema contracts between frontend and backend minimized integration bugs.
- Automated Cypress integration tests caught 4 critical regression issues during CI pipeline runs.

### Areas for Improvement
- Third-party webhook timeouts need retry queues with exponential backoff.
- Staging data seeding should be automated through Docker scripts rather than manual SQL dumps.`,
  },
  {
    id: "kn-5",
    title: "Deployment Checklist – Production",
    description: "Checklist for production deployment process.",
    context: "Company",
    type: "Guide",
    updatedAt: "3 days ago",
    updatedBy: {
      name: "Fikri Adriansyah",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
      initials: "FA",
    },
    views: 142,
    tags: ["devops", "deployment", "checklist"],
    content: `# Production Deployment Checklist

### Pre-Deployment
- [ ] Ensure all pull requests are reviewed, approved, and merged to \`main\`.
- [ ] Confirm staging regression test suite passed with 100% green status.
- [ ] Check database migration scripts for backward-compatibility.
- [ ] Notify DevOps on-call engineer and post announcement on #deployments channel.

### Deployment Phase
- [ ] Trigger zero-downtime rolling deployment via GitHub Actions workflow.
- [ ] Run health check endpoint: \`curl https://api.summon.com/healthz\`.
- [ ] Monitor Datadog error rates and APM latency spikes for 15 minutes.

### Post-Deployment
- [ ] Verify core critical user flows.
- [ ] Mark deployment as completed in Release Management tracker.`,
  },
];

export const RECENT_NOTES: IRecentNote[] = [
  {
    id: "note-1",
    title: "Client Call – Pegadaian AI Interviewer",
    timeAgo: "10 minutes ago",
    iconColor: "yellow",
  },
  {
    id: "note-2",
    title: "Technical Discussion – BSB Module",
    timeAgo: "2 hours ago",
    iconColor: "green",
  },
  {
    id: "note-3",
    title: "Feedback from Demo – Mutiara MF",
    timeAgo: "1 day ago",
    iconColor: "blue",
  },
  {
    id: "note-4",
    title: "Weekly Sync Notes – 18 Aug 2025",
    timeAgo: "2 days ago",
    iconColor: "gray",
  },
  {
    id: "note-5",
    title: "Ideas – Automation Improvements",
    timeAgo: "3 days ago",
    iconColor: "orange",
  },
];

export const POPULAR_KNOWLEDGE: IPopularKnowledgeItem[] = [
  {
    id: "pop-1",
    title: "BSB System Architecture",
    views: 234,
    fireColor: "red",
  },
  {
    id: "pop-2",
    title: "UAT Process & Guidelines",
    views: 189,
    fireColor: "orange",
  },
  {
    id: "pop-3",
    title: "Proposal Template v2.0",
    views: 156,
    fireColor: "green",
  },
  {
    id: "pop-4",
    title: "Deployment Runbook",
    views: 142,
    fireColor: "orange",
  },
  {
    id: "pop-5",
    title: "Cost Estimation Guidelines",
    views: 98,
    fireColor: "blue",
  },
];

export const KNOWLEDGE_STATS: IKnowledgeStats = {
  totalArticles: 342,
  totalViews: "2,841",
  contributors: 18,
  thisMonthCount: 156,
  thisMonthGrowthPercentage: 12,
};

export const SUGGESTED_QUERIES = [
  "What is our architecture for BSB System?",
  "Show lessons learned from SANFIND project",
  "Where is the latest MoM template?",
];
