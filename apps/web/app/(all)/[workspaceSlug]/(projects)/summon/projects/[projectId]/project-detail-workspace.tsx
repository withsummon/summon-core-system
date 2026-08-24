import { useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, CalendarPlus, FilePlus2, ListPlus, Pencil, Settings2 } from "lucide-react";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import type { ISummonProjectOverview, IUserLite } from "@plane/types";
import { EIssuesStoreType } from "@plane/types";
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import projectMemberService from "@/services/project/project-member.service";
import { summonService } from "@/services/summon.service";
import { PROJECT_TABS, ProjectDetailTab, type TProjectTab } from "./project-detail-tabs";
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
  const [activeTab, setActiveTab] = useState<TProjectTab>("overview");
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
  const project = getProjectById(projectId);
  const lead = project?.project_lead;
  const leadDetails = typeof lead === "object" ? (lead as IUserLite) : lead ? getUserDetails(lead) : undefined;
  const members = memberships.flatMap((membership) => {
    const name = getUserDetails(membership.member)?.display_name;
    return name ? [{ id: membership.member, name }] : [];
  });
  const isAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT, workspaceSlug, projectId);

  return (
    <div className="min-h-full bg-surface-1 p-4 lg:p-5">
      <header className="border-b border-subtle pb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href={`/${workspaceSlug}/summon/projects/`}
              className="inline-flex items-center gap-1 text-[11px] text-secondary hover:text-primary"
            >
              <ArrowLeft className="size-3.5" /> All Projects
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-xs grid size-9 place-items-center rounded-lg bg-accent-subtle font-semibold text-accent-primary">
                {overview.project.identifier.slice(0, 2)}
              </span>
              <h1 className="text-2xl font-semibold tracking-tight text-primary">{overview.project.name}</h1>
              <span className="rounded-full bg-success-subtle px-2.5 py-1 text-[10px] text-success-primary">
                {overview.profile?.delivery_status?.replaceAll("_", " ") || "Status not set"}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-[11px]">
              <Meta label="Client" value={client?.company_name || client?.name || "Not linked"} />
              <Meta label="Project manager" value={leadDetails?.display_name || "Not assigned"} />
              <Meta label="Start date" value={formatDate(overview.profile?.start_date)} />
              <Meta label="Target date" value={formatDate(overview.profile?.target_date)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setEditingProfile((value) => !value)}
                className="text-xs inline-flex items-center gap-2 rounded-xl border border-subtle px-4 py-2.5 font-medium text-primary hover:bg-layer-1"
              >
                <Pencil className="size-4" /> Edit profile
              </button>
            )}
            <Link
              href={`/${workspaceSlug}/settings/projects/${projectId}/`}
              className="text-xs inline-flex items-center gap-2 rounded-xl bg-accent-primary px-4 py-2.5 font-medium text-white"
            >
              <Settings2 className="size-4" /> Advanced Settings
            </Link>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 gap-4 xl:grid-cols-[13.5rem_minmax(0,1fr)]">
        <aside className="border-r border-subtle py-4 pr-4 max-xl:border-r-0 max-xl:border-b max-xl:pr-0">
          <Link
            href={`/${workspaceSlug}/summon/projects/`}
            className="text-xs mb-5 flex items-center gap-3 rounded-xl border border-subtle p-3 text-primary hover:bg-layer-1"
          >
            <ArrowLeft className="size-4" />
            <span>
              <strong className="block">All Projects</strong>
              <small className="text-[10px] text-secondary">View project portfolio</small>
            </span>
          </Link>
          <p className="tracking-widest mb-2 text-[9px] font-semibold text-tertiary uppercase">Quick actions</p>
          <div className="grid gap-1 max-xl:grid-cols-2 md:max-xl:grid-cols-4">
            <Action
              label="New Task"
              icon={ListPlus}
              onClick={() => toggleCreateIssueModal(true, EIssuesStoreType.PROJECT, [projectId])}
            />
            <Action label="Create Milestone" icon={CalendarPlus} onClick={() => toggleCreateModuleModal(true)} />
            <Action label="Create Document" icon={FilePlus2} onClick={() => toggleCreatePageModal({ isOpen: true })} />
            <Link
              href={`/${workspaceSlug}/summon/meetings/?project=${projectId}`}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] text-secondary hover:bg-layer-1"
            >
              <CalendarPlus className="size-3.5" /> Schedule Meeting
            </Link>
          </div>
        </aside>

        <main className="min-w-0 py-4">
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
          <nav
            className="flex gap-6 overflow-x-auto border-b border-subtle"
            aria-label="Project section tabs"
            role="tablist"
          >
            {PROJECT_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                id={`project-tab-${tab.id}`}
                aria-controls="project-tab-panel"
                aria-selected={activeTab === tab.id}
                role="tab"
                className={`shrink-0 border-b-2 px-1 pb-3 text-[11px] ${activeTab === tab.id ? "border-accent-primary font-medium text-accent-primary" : "border-transparent text-secondary hover:text-primary"}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <div id="project-tab-panel" className="mt-4" role="tabpanel" aria-labelledby={`project-tab-${activeTab}`}>
            {activeTab === "overview" ? (
              <ProjectOverviewTab
                overview={overview}
                workspaceSlug={workspaceSlug}
                projectId={projectId}
                members={members}
              />
            ) : (
              <ProjectDetailTab
                tab={activeTab}
                overview={overview}
                workspaceSlug={workspaceSlug}
                projectId={projectId}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
});

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-tertiary">{label}</span>
      <strong className="ml-2 font-medium text-primary">{value}</strong>
    </div>
  );
}

function Action({ label, icon: Icon, onClick }: { label: string; icon: typeof ListPlus; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-[11px] text-secondary hover:bg-layer-1"
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}
