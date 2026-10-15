/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { lazy, Suspense } from "react";
import type { ComponentType, ReactNode } from "react";
import type {
  CompactAssetType,
  DetailedAssetType,
  HorizontalStackAssetType,
  IllustrationAssetType,
  VerticalStackAssetType,
} from "./asset-types";
import type { TIllustrationAssetProps } from "./helper";

type TIllustrationAsset = ComponentType<TIllustrationAssetProps>;

// Each illustration is its own chunk: an empty state loads only the SVG it renders
// instead of every illustration riding along with any screen that can show one.
const lazyAsset = (load: () => Promise<TIllustrationAsset>): TIllustrationAsset =>
  lazy(async () => ({ default: await load() }));

// Horizontal Stack Asset Registry
export const HORIZONTAL_STACK_ASSETS: Record<HorizontalStackAssetType, TIllustrationAsset> = {
  customer: lazyAsset(() => import("./horizontal-stack/customer").then((m) => m.CustomerHorizontalStackIllustration)),
  epic: lazyAsset(() => import("./horizontal-stack/epic").then((m) => m.EpicHorizontalStackIllustration)),
  estimate: lazyAsset(() => import("./horizontal-stack/estimate").then((m) => m.EstimateHorizontalStackIllustration)),
  export: lazyAsset(() => import("./horizontal-stack/export").then((m) => m.ExportHorizontalStackIllustration)),
  intake: lazyAsset(() => import("./horizontal-stack/intake").then((m) => m.IntakeHorizontalStackIllustration)),
  label: lazyAsset(() => import("./horizontal-stack/label").then((m) => m.LabelHorizontalStackIllustration)),
  link: lazyAsset(() => import("./horizontal-stack/link").then((m) => m.LinkHorizontalStackIllustration)),
  members: lazyAsset(() => import("./horizontal-stack/members").then((m) => m.MembersHorizontalStackIllustration)),
  note: lazyAsset(() => import("./horizontal-stack/note").then((m) => m.NoteHorizontalStackIllustration)),
  priority: lazyAsset(() => import("./horizontal-stack/priority").then((m) => m.PriorityHorizontalStackIllustration)),
  project: lazyAsset(() => import("./horizontal-stack/project").then((m) => m.ProjectHorizontalStackIllustration)),
  settings: lazyAsset(() => import("./horizontal-stack/settings").then((m) => m.SettingsHorizontalStackIllustration)),
  state: lazyAsset(() => import("./horizontal-stack/state").then((m) => m.StateHorizontalStackIllustration)),
  template: lazyAsset(() => import("./horizontal-stack/template").then((m) => m.TemplateHorizontalStackIllustration)),
  token: lazyAsset(() => import("./horizontal-stack/token").then((m) => m.TokenHorizontalStackIllustration)),
  unknown: lazyAsset(() => import("./horizontal-stack/unknown").then((m) => m.UnknownHorizontalStackIllustration)),
  update: lazyAsset(() => import("./horizontal-stack/update").then((m) => m.UpdateHorizontalStackIllustration)),
  webhook: lazyAsset(() => import("./horizontal-stack/webhook").then((m) => m.WebhookHorizontalStackIllustration)),
  "work-item": lazyAsset(() =>
    import("./horizontal-stack/work-item").then((m) => m.WorkItemHorizontalStackIllustration)
  ),
  worklog: lazyAsset(() => import("./horizontal-stack/worklog").then((m) => m.WorklogHorizontalStackIllustration)),
};

// Vertical Stack Asset Registry
export const VERTICAL_STACK_ASSETS: Record<VerticalStackAssetType, TIllustrationAsset> = {
  "archived-cycle": lazyAsset(() =>
    import("./vertical-stack/archived-cycle").then((m) => m.ArchivedCycleVerticalStackIllustration)
  ),
  "archived-module": lazyAsset(() =>
    import("./vertical-stack/archived-module").then((m) => m.ArchivedModuleVerticalStackIllustration)
  ),
  "archived-work-item": lazyAsset(() =>
    import("./vertical-stack/archived-work-item").then((m) => m.ArchivedWorkItemVerticalStackIllustration)
  ),
  automation: lazyAsset(() => import("./vertical-stack/automation").then((m) => m.AutomationVerticalStackIllustration)),
  changelog: lazyAsset(() => import("./vertical-stack/changelog").then((m) => m.ChangelogVerticalStackIllustration)),
  conversation: lazyAsset(() =>
    import("./vertical-stack/conversation").then((m) => m.ConversationVerticalStackIllustration)
  ),
  credential: lazyAsset(() => import("./vertical-stack/credential").then((m) => m.CredentialVerticalStackIllustration)),
  customer: lazyAsset(() => import("./vertical-stack/customer").then((m) => m.CustomerVerticalStackIllustration)),
  cycle: lazyAsset(() => import("./vertical-stack/cycle").then((m) => m.CycleVerticalStackIllustration)),
  dashboard: lazyAsset(() => import("./vertical-stack/dashboard").then((m) => m.DashboardVerticalStackIllustration)),
  draft: lazyAsset(() => import("./vertical-stack/draft").then((m) => m.DraftVerticalStackIllustration)),
  epic: lazyAsset(() => import("./vertical-stack/epic").then((m) => m.EpicVerticalStackIllustration)),
  "error-404": lazyAsset(() => import("./vertical-stack/404-error").then((m) => m.Error404VerticalStackIllustration)),
  initiative: lazyAsset(() => import("./vertical-stack/initiative").then((m) => m.InitiativeVerticalStackIllustration)),
  "invalid-link": lazyAsset(() =>
    import("./vertical-stack/invalid-link").then((m) => m.InvalidLinkVerticalStackIllustration)
  ),
  knowledge: lazyAsset(() => import("./vertical-stack/knowledge").then((m) => m.KnowledgeVerticalStackIllustration)),
  meeting: lazyAsset(() => import("./vertical-stack/meeting").then((m) => m.MeetingVerticalStackIllustration)),
  module: lazyAsset(() => import("./vertical-stack/module").then((m) => m.ModuleVerticalStackIllustration)),
  "no-access": lazyAsset(() => import("./vertical-stack/no-access").then((m) => m.NoAccessVerticalStackIllustration)),
  opportunity: lazyAsset(() =>
    import("./vertical-stack/opportunity").then((m) => m.OpportunityVerticalStackIllustration)
  ),
  page: lazyAsset(() => import("./vertical-stack/page").then((m) => m.PageVerticalStackIllustration)),
  project: lazyAsset(() => import("./vertical-stack/project").then((m) => m.ProjectVerticalStackIllustration)),
  "server-error": lazyAsset(() =>
    import("./vertical-stack/server-error").then((m) => m.ServerErrorVerticalStackIllustration)
  ),
  teamspace: lazyAsset(() => import("./vertical-stack/teamspace").then((m) => m.TeamspaceVerticalStackIllustration)),
  view: lazyAsset(() => import("./vertical-stack/view").then((m) => m.ViewVerticalStackIllustration)),
  "work-item": lazyAsset(() => import("./vertical-stack/work-item").then((m) => m.WorkItemVerticalStackIllustration)),
};

// Illustration Asset Registry
export const ILLUSTRATION_ASSETS: Record<IllustrationAssetType, TIllustrationAsset> = {
  inbox: lazyAsset(() => import("./illustration/inbox").then((m) => m.InboxIllustration)),
  search: lazyAsset(() => import("./illustration/search").then((m) => m.SearchIllustration)),
};

const renderAsset = (AssetComponent: TIllustrationAsset, className?: string): ReactNode => (
  <Suspense fallback={null}>
    <AssetComponent className={className} />
  </Suspense>
);

// Helper functions to get assets
export const getCompactAsset = (assetKey: CompactAssetType, className?: string): ReactNode => {
  const AssetComponent =
    HORIZONTAL_STACK_ASSETS[assetKey as HorizontalStackAssetType] ||
    ILLUSTRATION_ASSETS[assetKey as IllustrationAssetType];

  if (!AssetComponent) {
    console.warn(`Asset "${assetKey}" not found in compact asset registry`);
    return null;
  }

  return renderAsset(AssetComponent, className);
};

export const getDetailedAsset = (assetKey: DetailedAssetType, className?: string): ReactNode => {
  const AssetComponent =
    VERTICAL_STACK_ASSETS[assetKey as VerticalStackAssetType] || ILLUSTRATION_ASSETS[assetKey as IllustrationAssetType];

  if (!AssetComponent) {
    console.warn(`Asset "${assetKey}" not found in detailed asset registry`);
    return null;
  }

  return renderAsset(AssetComponent, className);
};
