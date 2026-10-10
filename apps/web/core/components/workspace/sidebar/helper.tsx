/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import {
  ArchiveIcon,
  ArrowsClockwiseIcon,
  BellIcon,
  BookOpenIcon,
  BriefcaseIcon,
  CalendarDotsIcon,
  ChartBarIcon,
  ChartLineUpIcon,
  CheckSquareIcon,
  FileTextIcon,
  FlowArrowIcon,
  GearSixIcon,
  HandshakeIcon,
  HouseIcon,
  KeyIcon,
  NoteIcon,
  PencilSimpleLineIcon,
  SparkleIcon,
  SquaresFourIcon,
  StackIcon,
  TrayIcon,
  UserCircleIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { SelectableIcon } from "@plane/propel/icons";
import type { TSelectableIcon } from "@plane/propel/icons";

const NAVIGATION_ICONS: Record<string, TSelectableIcon> = {
  home: HouseIcon,
  inbox: TrayIcon,
  projects: BriefcaseIcon,
  views: SquaresFourIcon,
  active_cycles: ArrowsClockwiseIcon,
  analytics: ChartLineUpIcon,
  your_work: UserCircleIcon,
  drafts: PencilSimpleLineIcon,
  archives: ArchiveIcon,
  stickies: NoteIcon,
  summon: HouseIcon,
  summon_projects: BriefcaseIcon,
  summon_clients: UsersThreeIcon,
  summon_tasks: CheckSquareIcon,
  summon_meetings: CalendarDotsIcon,
  summon_documents: FileTextIcon,
  summon_knowledge: BookOpenIcon,
  summon_credentials: KeyIcon,
  summon_opportunities: HandshakeIcon,
  summon_reports: ChartBarIcon,
  summon_resources: StackIcon,
  summon_automation: FlowArrowIcon,
  summon_notifications: BellIcon,
  summon_assistant: SparkleIcon,
  summon_settings: GearSixIcon,
};

/** Outline at rest, filled when the enclosing nav item is active (see `SidebarNavItem`). */
export const getSidebarNavigationItemIcon = (key: string, className: string = "") => {
  const icon = NAVIGATION_ICONS[key];
  return icon ? <SelectableIcon icon={icon} className={className} /> : undefined;
};
