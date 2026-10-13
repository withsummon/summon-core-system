/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { BriefcaseIcon, CheckSquareIcon, FileTextIcon, HandshakeIcon, SquaresFourIcon } from "@phosphor-icons/react";
import { Send, Sparkles } from "lucide-react";
import { Chip } from "@plane/propel/chip";
import type { TSelectableIcon } from "@plane/propel/icons";
import { SummonRequestState } from "@/components/summon/request-state";
import { useSummonAccess } from "@/components/summon/use-summon-access";
import { useUser } from "@/hooks/store/user";
import { useWorkspaceMoney } from "@/components/summon/use-workspace-money";
import { summonService } from "@/services/summon.service";
import { SummonSearchField } from "@/components/summon/search-field";
import type { THomeFilter } from "./home-feed";
import { HomeFeed } from "./home-feed";
import { HomeProjectPreview } from "./home-project-preview";

interface IHomeRootProps {
  workspaceSlug: string;
}

const filters: Array<{ id: THomeFilter; label: string; icon: TSelectableIcon }> = [
  { id: "all", label: "All", icon: SquaresFourIcon },
  { id: "projects", label: "Projects", icon: BriefcaseIcon },
  { id: "tasks", label: "Tasks", icon: CheckSquareIcon },
  { id: "opportunities", label: "Opportunities", icon: HandshakeIcon },
  { id: "documents", label: "Documents", icon: FileTextIcon },
];

export function HomeRoot({ workspaceSlug }: IHomeRootProps) {
  const { data: user } = useUser();
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [filter, setFilter] = useState<THomeFilter>("all");
  const [query, setQuery] = useState("");
  const { data, error, isLoading, mutate } = useSWR(["summon-home", workspaceSlug], () =>
    summonService.getHomeSummary(workspaceSlug)
  );
  const showDeals = useSummonAccess(workspaceSlug).can("commercial.view");
  const { data: opportunities = [] } = useSWR(showDeals ? ["summon-opportunities", workspaceSlug] : null, () =>
    summonService.listOpportunities(workspaceSlug)
  );
  const money = useWorkspaceMoney(workspaceSlug);

  const activeProjectId = selectedProjectId || data?.projects[0]?.id || "";
  const { data: selectedProject, isLoading: projectLoading } = useSWR(
    activeProjectId ? ["summon-project-overview", workspaceSlug, activeProjectId] : null,
    () => summonService.getProjectOverview(workspaceSlug, activeProjectId)
  );
  const { data: selectedClient } = useSWR(
    selectedProject?.profile?.client ? ["summon-client", workspaceSlug, selectedProject.profile.client] : null,
    () => summonService.getClientDetail(workspaceSlug, selectedProject?.profile?.client || "")
  );

  const normalizedQuery = query.trim().toLowerCase();
  const visibleProjects = useMemo(
    () => data?.projects.filter((project) => project.name.toLowerCase().includes(normalizedQuery)) ?? [],
    [data?.projects, normalizedQuery]
  );
  const visiblePriority = useMemo(
    () =>
      data?.priority.filter((issue) => `${issue.name} ${issue.project.name}`.toLowerCase().includes(normalizedQuery)) ??
      [],
    [data?.priority, normalizedQuery]
  );
  const visibleOpportunities = useMemo(
    () => opportunities.filter((opportunity) => opportunity.title.toLowerCase().includes(normalizedQuery)),
    [opportunities, normalizedQuery]
  );

  if (!data) return <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />;

  const firstName = (user?.display_name || user?.first_name || "there").split(" ")[0];

  return (
    <div className="grid min-h-full bg-surface-1 xl:grid-cols-[minmax(20rem,0.72fr)_minmax(34rem,1.28fr)]">
      <section className="flex min-w-0 flex-col border-r border-subtle bg-surface-1 p-4 lg:p-6">
        <header>
          <p className="text-13 text-tertiary">Good to see you, {firstName}</p>
          <h1 className="mt-0.5 text-2xl font-semibold text-primary">Here&apos;s what&apos;s happening</h1>
        </header>

        <SummonSearchField
          label={showDeals ? "Search projects, tasks, opportunities" : "Search projects and tasks"}
          value={query}
          onValueChange={setQuery}
          className="mt-5"
          trailing={
            <kbd className="rounded-sm border border-subtle bg-layer-1 px-1.5 py-0.5 font-body text-11 font-medium text-tertiary">
              ⌘K
            </kbd>
          }
        />

        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filter home">
          {filters
            .filter((item) => showDeals || item.id !== "opportunities")
            .map((item) => (
              <Chip key={item.id} icon={item.icon} selected={filter === item.id} onClick={() => setFilter(item.id)}>
                {item.label}
              </Chip>
            ))}
        </div>

        <HomeFeed
          workspaceSlug={workspaceSlug}
          filter={filter}
          showDeals={showDeals}
          activeProjectId={activeProjectId}
          visiblePriority={visiblePriority}
          visibleProjects={visibleProjects}
          visibleOpportunities={visibleOpportunities}
          selectedProject={selectedProject}
          onSelectProject={setSelectedProjectId}
        />

        <Link
          href={`/${workspaceSlug}/summon/assistant/`}
          className="mt-auto flex h-11 press items-center gap-3 rounded-xl border border-subtle bg-surface-1 px-4 text-13 text-tertiary shadow-raised-200 hover:text-secondary"
        >
          <Sparkles className="size-4 text-accent-primary" />
          <span className="flex-1">Ask Summon Assistant anything…</span>
          <span className="grid size-7 place-items-center rounded-lg bg-accent-primary text-on-color shadow-tactile-accent">
            <Send className="size-3.5" />
          </span>
        </Link>
      </section>

      <HomeProjectPreview
        workspaceSlug={workspaceSlug}
        activeProjectId={activeProjectId}
        projectLoading={projectLoading}
        selectedProject={selectedProject}
        selectedClient={selectedClient}
        money={money}
      />
    </div>
  );
}
