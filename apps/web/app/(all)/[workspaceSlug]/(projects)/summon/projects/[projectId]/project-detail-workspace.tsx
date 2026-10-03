import { useState } from "react";
import { useNavigate } from "react-router";
import Link from "next/link";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { ArrowLeft, CalendarPlus, FilePlus2, ListPlus, Pencil, Settings2 } from "lucide-react";
import { CreateProjectIssue } from "@/components/convex-core/tasks/task-detail";
import { ModuleFormModal } from "@/components/convex-core/modules/forms";
import { MetadataForm } from "@/components/convex-core/documents/metadata-form";
import { PROJECT_TABS, ProjectDetailTab, type TProjectTab } from "./project-detail-tabs";
import { ProjectOverviewTab } from "./project-overview-tab";
import { ProjectProfileEditor } from "./project-profile-editor";

const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
    : "Not set";

export function ProjectDetailWorkspace({
  overview,
  address,
}: {
  overview: FunctionReturnType<typeof api.reporting.overview.project>;
  address: FunctionReturnType<typeof api.navigation.address.resolveProjectId>;
}) {
  const workspaceSlug = address.workspace.slug,
    projectId = address.project._id;
  const [activeTab, setActiveTab] = useState<TProjectTab>("overview");
  const [editingProfile, setEditingProfile] = useState(false);
  const [creating, setCreating] = useState<"task" | "module" | "document" | null>(null);
  const states = useQuery(api.tasks.states.list, { projectId });
  const navigate = useNavigate();
  const client = overview.client,
    sourceOpportunity = overview.sourceOpportunity;
  const sourceOpportunityId = overview.profile?.sourceOpportunityId;
  const isAdmin = overview.canManage;
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
                {overview.profile?.deliveryStatus.replaceAll("_", " ") || "Status not set"}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-[11px]">
              <Meta
                label="Client"
                value={client ? client.companyName || client.name : "Not linked"}
                href={client ? `/${workspaceSlug}/summon/clients/${client._id}/` : undefined}
              />
              {sourceOpportunityId ? (
                <Meta
                  label="Opportunity"
                  value={sourceOpportunity?.title || "Won opportunity"}
                  href={`/${workspaceSlug}/summon/opportunities/${sourceOpportunityId}/`}
                />
              ) : null}
              <Meta label="Project manager" value={overview.lead?.name} empty="Not assigned" />
              <Meta label="Start date" value={formatDate(overview.profileForm.startDate)} />
              <Meta label="Target date" value={formatDate(overview.profileForm.targetDate)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setEditingProfile(true)}
                disabled={editingProfile}
                aria-expanded={editingProfile}
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
              onClick={() => setCreating("task")}
              disabled={!overview.canWrite}
            />
            <Action
              label="Create Milestone"
              icon={CalendarPlus}
              onClick={() => setCreating("module")}
              disabled={!overview.canWrite || !overview.project.features?.modules}
            />
            <Action
              label="Create Document"
              icon={FilePlus2}
              onClick={() => setCreating("document")}
              disabled={!overview.canWrite}
            />
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
                overview={overview}
                onClose={() => setEditingProfile(false)}
                onSaved={() => setEditingProfile(false)}
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
              <ProjectOverviewTab overview={overview} workspaceSlug={workspaceSlug} projectId={projectId} />
            ) : (
              <ProjectDetailTab tab={activeTab} workspaceSlug={workspaceSlug} projectId={projectId} />
            )}
          </div>
        </main>
      </div>
      {creating === "task" && states && (
        <CreateProjectIssue
          address={address}
          states={states}
          canCreate={overview.canWrite}
          onClose={() => setCreating(null)}
        />
      )}
      {creating === "module" && (
        <ModuleFormModal
          projectId={projectId}
          module={null}
          onClose={() => setCreating(null)}
          onDone={(id, allow) => {
            setCreating(null);
            if (allow) navigate(`/${workspaceSlug}/projects/${projectId}/modules/${id}/`);
          }}
        />
      )}
      {creating === "document" && (
        <MetadataForm
          workspaceId={address.workspace._id}
          document={null}
          canManage
          dialog
          initialProjectId={projectId}
          onCancel={() => setCreating(null)}
          onDone={(id) => {
            setCreating(null);
            navigate(`/${workspaceSlug}/projects/${projectId}/pages/${id}/`);
          }}
        />
      )}
    </div>
  );
}

function Meta({ label, value, href, empty }: { label: string; value?: string | null; href?: string; empty?: string }) {
  return (
    <div>
      <span className="text-tertiary">{label}</span>
      {href ? (
        <Link href={href} className="ml-2 font-medium text-accent-primary hover:underline">
          {value}
        </Link>
      ) : (
        <strong className="ml-2 font-medium text-primary">{value || empty}</strong>
      )}
    </div>
  );
}

function Action({
  label,
  icon: Icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: typeof ListPlus;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-[11px] text-secondary hover:bg-layer-1"
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}
