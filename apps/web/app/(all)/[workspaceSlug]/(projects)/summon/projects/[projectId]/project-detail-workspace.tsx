import { useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, CalendarPlus, FilePlus2, ListPlus, Pencil, Settings2 } from "lucide-react";
import { Button } from "@plane/propel/button";
import { Tabs } from "@plane/propel/tabs";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import type { ISummonProjectOverview, IUserLite } from "@plane/types";
import { EIssuesStoreType } from "@plane/types";
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import projectMemberService from "@/services/project/project-member.service";
import { summonService } from "@/services/summon.service";
import { PROJECT_TABS, ProjectDetailTab } from "./project-detail-tabs";
import { ProjectOverviewTab } from "./project-overview-tab";
import { ProjectProfileEditor } from "./project-profile-editor";

const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
    : "Not set";

export const ProjectDetailWorkspace = observer(function ProjectDetailWorkspace(props: {
  overview: ISummonProjectOverview;
  workspaceSlug: string;
  projectId: string;
  onRefresh: () => Promise<void>;
}) {
  const { overview, workspaceSlug, projectId, onRefresh } = props;
  const [editingProfile, setEditingProfile] = useState(false);
  const { allowPermissions } = useUserPermissions();
  const { getProjectById } = useProject();
  const { getUserDetails } = useMember();
  const { toggleCreateIssueModal, toggleCreateModuleModal, toggleCreatePageModal } = useCommandPalette();
  const { data: memberships = [] } = useSWR(["summon-project-members", workspaceSlug, projectId], () =>
    projectMemberService.fetchProjectMembers(workspaceSlug, projectId)
  );
  const { data: client } = useSWR(
    overview.profile?.client ? ["summon-project-client", workspaceSlug, overview.profile.client] : null,
    () => summonService.getClient(workspaceSlug, overview.profile?.client || "")
  );
  const sourceOpportunityId = overview.profile?.source_opportunity;
  const { data: sourceOpportunity } = useSWR(
    sourceOpportunityId ? ["summon-project-opportunity", workspaceSlug, sourceOpportunityId] : null,
    () => summonService.getOpportunity(workspaceSlug, sourceOpportunityId || "")
  );
  const project = getProjectById(projectId);
  const lead = project?.project_lead;
  const leadDetails = typeof lead === "object" ? (lead as IUserLite) : lead ? getUserDetails(lead) : undefined;
  const members = memberships.flatMap((membership) => {
    const name = getUserDetails(membership.member)?.display_name;
    return name ? [{ id: membership.member, name }] : [];
  });
  const isAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT, workspaceSlug, projectId);

  return (
    <div className="min-h-full min-w-0 bg-surface-1">
      <header className="border-b border-subtle px-4 py-4 sm:px-6">
        <Link
          href={`/${workspaceSlug}/summon/projects/`}
          className="text-xs inline-flex items-center gap-1.5 rounded text-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-accent-strong"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" /> Projects
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="text-xs grid size-8 shrink-0 place-items-center rounded-md border border-subtle bg-layer-1 font-medium text-secondary">
              {overview.project.identifier.slice(0, 2)}
            </span>
            <h1 className="text-lg font-semibold tracking-tight break-words text-primary">{overview.project.name}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <Button
                variant="secondary"
                size="base"
                prependIcon={<Pencil aria-hidden="true" />}
                onClick={() => setEditingProfile((value) => !value)}
              >
                Edit profile
              </Button>
            )}
            <Button
              size="base"
              prependIcon={<ListPlus aria-hidden="true" />}
              onClick={() => toggleCreateIssueModal(true, EIssuesStoreType.PROJECT, [projectId])}
            >
              New task
            </Button>
          </div>
        </div>
        <div className="text-xs mt-3 flex flex-wrap gap-x-6 gap-y-2">
          <Meta
            label="Client"
            value={client?.company_name || client?.name || "Not linked"}
            href={client ? `/${workspaceSlug}/summon/clients/${client.id}/` : undefined}
          />
          {sourceOpportunityId && (
            <Meta
              label="Opportunity"
              value={sourceOpportunity?.title || "Won opportunity"}
              href={`/${workspaceSlug}/summon/opportunities/${sourceOpportunityId}/`}
            />
          )}
          <Meta label="Lead" value={leadDetails?.display_name || "Not assigned"} />
          <Meta label="Target" value={formatDate(overview.profile?.target_date)} />
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-1 border-b border-subtle px-3 py-2 sm:px-5">
        <Button
          variant="ghost"
          size="base"
          prependIcon={<CalendarPlus aria-hidden="true" />}
          onClick={() => toggleCreateModuleModal(true)}
        >
          Milestone
        </Button>
        <Button
          variant="ghost"
          size="base"
          prependIcon={<FilePlus2 aria-hidden="true" />}
          onClick={() => toggleCreatePageModal({ isOpen: true })}
        >
          Document
        </Button>
        <Link
          href={`/${workspaceSlug}/summon/meetings/?project=${projectId}`}
          className="text-xs inline-flex items-center gap-2 rounded-md px-3 py-2 text-secondary hover:bg-layer-1 focus-visible:outline-2 focus-visible:outline-accent-strong"
        >
          <CalendarPlus aria-hidden="true" className="size-3.5" />
          Meeting
        </Link>
        {isAdmin && (
          <Link
            href={`/${workspaceSlug}/settings/projects/${projectId}/`}
            className="text-xs ml-auto inline-flex items-center gap-2 rounded-md px-3 py-2 text-secondary hover:bg-layer-1 focus-visible:outline-2 focus-visible:outline-accent-strong"
          >
            <Settings2 aria-hidden="true" className="size-3.5" />
            Settings
          </Link>
        )}
      </div>
      <main className="min-w-0 px-4 py-4 sm:px-6">
        {editingProfile && (
          <div className="mb-4">
            <ProjectProfileEditor
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              profile={overview.profile}
              onClose={() => setEditingProfile(false)}
              onSaved={onRefresh}
            />
          </div>
        )}
        <Tabs defaultValue="overview">
          <Tabs.List
            aria-label="Project sections"
            className="justify-start gap-1 rounded-none border-b border-subtle bg-transparent pb-2"
          >
            {PROJECT_TABS.map((tab) => (
              <Tabs.Trigger key={tab.id} value={tab.id} className="w-auto shrink-0 px-3 py-1.5">
                {tab.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          {PROJECT_TABS.map((tab) => (
            <Tabs.Content key={tab.id} value={tab.id} className="pt-5">
              {tab.id === "overview" ? (
                <ProjectOverviewTab
                  overview={overview}
                  workspaceSlug={workspaceSlug}
                  projectId={projectId}
                  members={members}
                />
              ) : (
                <ProjectDetailTab
                  tab={tab.id}
                  overview={overview}
                  workspaceSlug={workspaceSlug}
                  projectId={projectId}
                />
              )}
            </Tabs.Content>
          ))}
        </Tabs>
      </main>
    </div>
  );
});

function Meta({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div>
      <span className="text-tertiary">{label}</span>
      {href ? (
        <Link href={href} className="ml-2 font-medium text-accent-primary hover:underline">
          {value}
        </Link>
      ) : (
        <strong className="ml-2 font-medium text-primary">{value}</strong>
      )}
    </div>
  );
}
