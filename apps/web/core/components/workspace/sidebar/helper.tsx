/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import {
  AnalyticsIcon,
  ArchiveIcon,
  CycleIcon,
  DraftIcon,
  HomeIcon,
  InboxIcon,
  MultipleStickyIcon,
  ProjectIcon,
  ViewsIcon,
  YourWorkIcon,
} from "@plane/propel/icons";
import {
  Bell,
  BookOpen,
  Bot,
  Briefcase,
  CalendarDays,
  FileText,
  KeyRound,
  ListTodo,
  SettingsIcon,
  Users,
  Workflow,
} from "lucide-react";
import { cn } from "@plane/utils";

export const getSidebarNavigationItemIcon = (key: string, className: string = "") => {
  switch (key) {
    case "home":
      return <HomeIcon className={cn("size-4 flex-shrink-0", className)} />;
    case "inbox":
      return <InboxIcon className={cn("size-4 flex-shrink-0", className)} />;
    case "projects":
      return <ProjectIcon className={cn("size-4 flex-shrink-0", className)} />;
    case "views":
      return <ViewsIcon className={cn("size-4 flex-shrink-0", className)} />;
    case "active_cycles":
      return <CycleIcon className={cn("size-4 flex-shrink-0", className)} />;
    case "analytics":
      return <AnalyticsIcon className={cn("size-4 flex-shrink-0", className)} />;
    case "your_work":
      return <YourWorkIcon className={cn("size-4 flex-shrink-0", className)} />;
    case "drafts":
      return <DraftIcon className={cn("size-4 flex-shrink-0", className)} />;
    case "archives":
      return <ArchiveIcon className={cn("size-4 flex-shrink-0", className)} />;
    case "stickies":
      return <MultipleStickyIcon className={cn("size-4 flex-shrink-0", className)} />;
    case "summon":
      return <HomeIcon className={cn("size-4 flex-shrink-0", className)} />;
    case "summon_projects":
      return <ProjectIcon className={cn("size-4 flex-shrink-0", className)} />;
    case "summon_clients":
      return <Users className={cn("size-4 flex-shrink-0", className)} />;
    case "summon_tasks":
      return <ListTodo className={cn("size-4 flex-shrink-0", className)} />;
    case "summon_meetings":
      return <CalendarDays className={cn("size-4 flex-shrink-0", className)} />;
    case "summon_documents":
      return <FileText className={cn("size-4 flex-shrink-0", className)} />;
    case "summon_knowledge":
      return <BookOpen className={cn("size-4 flex-shrink-0", className)} />;
    case "summon_credentials":
      return <KeyRound className={cn("size-4 flex-shrink-0", className)} />;
    case "summon_opportunities":
      return <Briefcase className={cn("size-4 flex-shrink-0", className)} />;
    case "summon_reports":
      return <AnalyticsIcon className={cn("size-4 flex-shrink-0", className)} />;
    case "summon_resources":
      return <ViewsIcon className={cn("size-4 flex-shrink-0", className)} />;
    case "summon_automation":
      return <Workflow className={cn("size-4 flex-shrink-0", className)} />;
    case "summon_notifications":
      return <Bell className={cn("size-4 flex-shrink-0", className)} />;
    case "summon_assistant":
      return <Bot className={cn("size-4 flex-shrink-0", className)} />;
    case "summon_settings":
      return <SettingsIcon className={cn("size-4 flex-shrink-0", className)} />;
  }
};
