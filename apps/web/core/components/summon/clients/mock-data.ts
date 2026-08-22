/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { IClientDetail } from "./types";

export const PEGADAIAN_CLIENT: IClientDetail = {
  id: "pegadaian",
  name: "Pegadaian",
  legalName: "PT Pegadaian (Persero)",
  status: "Active Client",
  since: "17 Jan 2024",
  industry: "Financial Services",
  website: "www.pegadaian.co.id",
  headOffice: "Jakarta, Indonesia",
  accountManager: {
    name: "Fikri Adriansyah",
  },
  description:
    "PT Pegadaian (Persero) is a state-owned enterprise engaged in pawnshop and gold business, with a wide range of financial services across Indonesia.",
  kpis: {
    activeOpportunities: 1,
    activeProjects: 0,
    totalProjects: 2,
    lastInteraction: "2 days ago",
    lastInteractionDetail: "Demo follow up",
  },
  opportunities: [
    {
      id: "opp-1",
      title: "AI Interviewer",
      category: "POC / Discovery",
      stage: "Discovery",
      owner: {
        name: "Adi Prasetyo",
      },
      valueIdr: "-",
      closeDate: "30 Jun 2025",
      progress: 25,
    },
  ],
  projects: [
    {
      id: "proj-1",
      name: "AI Interviewer Platform",
      type: "POC",
      status: "Completed",
      owner: {
        name: "Fikri Adriansyah",
      },
      startDate: "15 Apr 2025",
      endDate: "30 May 2025",
    },
    {
      id: "proj-2",
      name: "Core Banking System Integration",
      type: "Implementation",
      status: "Completed",
      owner: {
        name: "Wibi Susanto",
      },
      startDate: "10 Jan 2025",
      endDate: "28 Feb 2025",
    },
  ],
  contacts: [
    {
      id: "contact-1",
      name: "Andika Pratama",
      role: "Human Capital Manager",
      email: "andika.pratama@pegadaian.co.id",
      phone: "+62 812 3456 7890",
      isPrimary: true,
    },
    {
      id: "contact-2",
      name: "Budi Santoso",
      role: "IT Manager",
      email: "budi.santoso@pegadaian.co.id",
      phone: "+62 811 2233 4455",
    },
    {
      id: "contact-3",
      name: "Citra Lestari",
      role: "Finance Manager",
      email: "citra.lestari@pegadaian.co.id",
      phone: "+62 812 7788 9900",
    },
  ],
  activities: [
    {
      id: "act-1",
      title: "Demo follow up meeting",
      timestamp: "2 days ago",
      author: "Fikri Adriansyah",
      type: "meeting",
    },
    {
      id: "act-2",
      title: "MoM - Demo Discussion",
      timestamp: "3 days ago",
      author: "Summon Assistant",
      type: "document",
    },
    {
      id: "act-3",
      title: "Uploaded Architecture Diagram",
      timestamp: "1 week ago",
      author: "Adi Prasetyo",
      type: "upload",
    },
    {
      id: "act-4",
      title: "Proposal sent",
      timestamp: "2 weeks ago",
      author: "Fikri Adriansyah",
      type: "proposal",
    },
    {
      id: "act-5",
      title: "Kick-off meeting",
      timestamp: "1 month ago",
      author: "Rafael Lorenzo",
      type: "event",
    },
  ],
  relationshipHealth: {
    status: "Good",
    summary: "Strong engagement and on-track delivery.",
    communication: "Last: 2 days ago",
    projectsOnTrack: "72% on average",
    satisfaction: "Based on feedback",
  },
  notes: [
    {
      id: "note-1",
      title: "Kick-off Meeting Notes",
      date: "19 May 2025",
      author: "Fikri Adriansyah",
    },
    {
      id: "note-2",
      title: "Client Expectation Summary",
      date: "18 Mar 2025",
      author: "Rafael Lorenzo",
    },
  ],
};

export const ALL_CLIENTS_DIRECTORY: IClientDetail[] = [
  PEGADAIAN_CLIENT,
  {
    id: "bsb",
    name: "Bank Sinar Bahana",
    legalName: "PT Bank Sinar Bahana Tbk",
    status: "Active Client",
    since: "05 Mar 2023",
    industry: "Banking",
    website: "www.sinarbahana.co.id",
    headOffice: "Jakarta, Indonesia",
    accountManager: {
      name: "Rafael Lorenzo",
    },
    description: "Leading private commercial bank with nationwide branches offering digital enterprise banking.",
    kpis: {
      activeOpportunities: 2,
      activeProjects: 3,
      totalProjects: 5,
      lastInteraction: "Yesterday",
      lastInteractionDetail: "Architecture Review",
    },
    opportunities: [],
    projects: [],
    contacts: [],
    activities: [],
    relationshipHealth: {
      status: "Excellent",
      summary: "Strategic key account with multi-year engagement.",
      communication: "Last: Yesterday",
      projectsOnTrack: "90% on average",
      satisfaction: "High NPS (9.4/10)",
    },
    notes: [],
  },
  {
    id: "sanfind",
    name: "SANFIND",
    legalName: "PT Sanfind Finansial Solusi",
    status: "Active Client",
    since: "12 Aug 2024",
    industry: "Fintech & Lending",
    website: "www.sanfind.id",
    headOffice: "Surabaya, Indonesia",
    accountManager: {
      name: "Adi Prasetyo",
    },
    description: "Digital credit scoring and risk analytics platform for financial institutions.",
    kpis: {
      activeOpportunities: 1,
      activeProjects: 1,
      totalProjects: 2,
      lastInteraction: "4 days ago",
      lastInteractionDetail: "API Release Sync",
    },
    opportunities: [],
    projects: [],
    contacts: [],
    activities: [],
    relationshipHealth: {
      status: "Good",
      summary: "Steady delivery cadence and active sprint involvement.",
      communication: "Last: 4 days ago",
      projectsOnTrack: "85% on average",
      satisfaction: "Positive",
    },
    notes: [],
  },
  {
    id: "mutiara-mf",
    name: "Mutiara Multifinance",
    legalName: "PT Mutiara Multifinance Indonesia",
    status: "Active Client",
    since: "02 Feb 2024",
    industry: "Multi-finance",
    website: "www.mutiaramf.co.id",
    headOffice: "Bandung, Indonesia",
    accountManager: {
      name: "Fikri Adriansyah",
    },
    description: "Consumer financing and commercial equipment leasing provider.",
    kpis: {
      activeOpportunities: 0,
      activeProjects: 1,
      totalProjects: 1,
      lastInteraction: "1 week ago",
      lastInteractionDetail: "UAT Sign-off",
    },
    opportunities: [],
    projects: [],
    contacts: [],
    activities: [],
    relationshipHealth: {
      status: "Good",
      summary: "Phase 1 delivered on schedule, entering hypercare.",
      communication: "Last: 1 week ago",
      projectsOnTrack: "100%",
      satisfaction: "Satisfied",
    },
    notes: [],
  },
];
