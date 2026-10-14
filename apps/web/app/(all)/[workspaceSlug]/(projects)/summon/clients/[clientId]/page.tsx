/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import {
  AddressBookIcon,
  BriefcaseIcon,
  ClockCounterClockwiseIcon,
  FileTextIcon,
  GearSixIcon,
  HandshakeIcon,
  NoteIcon,
  SquaresFourIcon,
} from "@phosphor-icons/react";
import useSWR from "swr";
import { PageHead } from "@/components/core/page-title";
import { SummonRequestState } from "@/components/summon/request-state";
import { SectionTabs } from "@/components/summon/section-tabs";
import type { TSectionTab } from "@/components/summon/section-tabs";
import { ViewPanel } from "@/components/summon/screen";
import { useHashTab } from "@/components/summon/use-hash-tab";
import { useMember } from "@/hooks/store/use-member";
import { useWorkspaceMoney } from "@/components/summon/use-workspace-money";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";
import { ClientOverviewAside } from "./client-detail-aside";
import { ClientDetailHeader } from "./client-detail-header";
import {
  ClientActivityPanel,
  ClientContactsPanel,
  ClientOpportunitiesPanel,
  ClientOverviewMetrics,
  ClientPagesPanel,
  ClientProjectsPanel,
  ClientSettingsPanel,
} from "./client-detail-panels";
import type { TClientTab } from "./client-detail-shared";
import { ClientEditDialog } from "./client-edit-dialog";

const CLIENT_TABS: TSectionTab<TClientTab>[] = [
  { value: "overview", label: "Overview", icon: SquaresFourIcon },
  { value: "opportunities", label: "Opportunities", icon: HandshakeIcon },
  { value: "projects", label: "Projects", icon: BriefcaseIcon },
  { value: "contacts", label: "Contacts", icon: AddressBookIcon },
  { value: "documents", label: "Documents", icon: FileTextIcon },
  { value: "activity", label: "Activity", icon: ClockCounterClockwiseIcon },
  { value: "notes", label: "Notes", icon: NoteIcon },
  { value: "settings", label: "Settings", icon: GearSixIcon },
];

export default function SummonClientDetailPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, clientId } = params;
  const { getUserDetails } = useMember();
  const [activeTab, setActiveTab] = useHashTab(CLIENT_TABS.map((tab) => tab.value));
  const [editing, setEditing] = useState(false);
  const { data, error, isLoading, mutate } = useSWR(["summon-client", workspaceSlug, clientId], () =>
    summonService.getClientDetail(workspaceSlug, clientId)
  );
  const money = useWorkspaceMoney(workspaceSlug);

  if (!data) return <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />;

  // The API leaves deals out for roles without `commercial.view`.
  const deals = data.opportunities;
  const tabs = deals ? CLIENT_TABS : CLIENT_TABS.filter((tab) => tab.value !== "opportunities");
  const ownerName = data.owner ? getUserDetails(data.owner)?.display_name : undefined;
  const isOverview = activeTab === "overview";
  const showTab = (tab: TClientTab) => isOverview || activeTab === tab;
  /** On the overview, a section links to its own tab. */
  const viewAll = (tab: TClientTab, label: string) => (isOverview ? { href: `#${tab}`, label } : undefined);
  const openEdit = () => setEditing(true);

  return (
    <section className="mx-auto min-h-full w-full max-w-[1600px] overflow-hidden p-4 lg:p-5">
      <PageHead title={`${data.name} · Summon Core`} />
      <ClientDetailHeader
        workspaceSlug={workspaceSlug}
        data={data}
        canCreateOpportunity={Boolean(deals)}
        onEdit={openEdit}
      />

      <SectionTabs
        items={tabs}
        value={activeTab}
        onValueChange={setActiveTab}
        label="Client sections"
        className="mt-5"
      />

      <ViewPanel value={activeTab}>
        <div
          className={`mt-4 grid min-w-0 items-start gap-4 ${isOverview ? "xl:grid-cols-[minmax(0,1fr)_20rem]" : "grid-cols-1"}`}
        >
          <main className="min-w-0 space-y-4">
            {isOverview ? <ClientOverviewMetrics data={data} /> : null}
            {deals && showTab("opportunities") ? (
              <ClientOpportunitiesPanel
                workspaceSlug={workspaceSlug}
                deals={deals}
                link={viewAll("opportunities", "View all opportunities")}
                money={money}
                getUserDetails={getUserDetails}
              />
            ) : null}
            {showTab("projects") ? (
              <ClientProjectsPanel
                workspaceSlug={workspaceSlug}
                projects={data.projects}
                link={viewAll("projects", "View all projects")}
              />
            ) : null}
            {showTab("contacts") ? (
              <ClientContactsPanel contacts={data.contacts} link={viewAll("contacts", "View all contacts")} />
            ) : null}
            {showTab("activity") ? (
              <ClientActivityPanel activity={data.recent_activity} link={viewAll("activity", "View all activity")} />
            ) : null}
            {activeTab === "documents" || activeTab === "notes" ? (
              <ClientPagesPanel kind={activeTab} pageContexts={data.page_contexts} />
            ) : null}
            {activeTab === "settings" ? (
              <ClientSettingsPanel data={data} ownerName={ownerName} onEdit={openEdit} />
            ) : null}
          </main>

          {isOverview ? (
            <ClientOverviewAside data={data} ownerName={ownerName} notesLink={viewAll("notes", "View all notes")} />
          ) : null}
        </div>
      </ViewPanel>

      <ClientEditDialog
        workspaceSlug={workspaceSlug}
        clientId={clientId}
        data={data}
        open={editing}
        onOpenChange={setEditing}
        onSaved={() => mutate()}
      />
    </section>
  );
}
