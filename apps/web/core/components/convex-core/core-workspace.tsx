import { LeaveMembership } from "./memberships/leave";
import { MembershipAccessBoundary } from "./memberships/access-boundary";
import { Onboarding } from "./identity/onboarding/onboarding";
import { CreateWorkspace } from "./create-workspace";
import { ManagedInvitations } from "./invitations/manage";
import { SessionBoundary } from "./identity/session-boundary";
import { RecordVisit } from "./navigation/record-visit";
import { WorkspaceNavigation } from "./favorites/workspace-navigation";
import { FavoriteToggle } from "./favorites/toggle";
import { lazy, Suspense, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useConvexConnectionState, useMutation, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { FunctionReturnType } from "convex/server";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { SignIn } from "./sign-in";
import { ProjectTasks } from "./project-tasks";
import { Membership } from "./membership";
import { ProjectBoundary } from "./projects/boundary";
import { Profile } from "./identity/profile";
const ProjectSettings = lazy(() =>
  import("./projects/settings").then((module) => ({ default: module.ProjectSettings }))
);
const ArchivedProjects = lazy(() =>
  import("./projects/archived").then((module) => ({ default: module.ArchivedProjects }))
);
const QuickLinks = lazy(() => import("./quick-links/quick-links").then((module) => ({ default: module.QuickLinks })));
const Automation = lazy(() => import("./automation/automation").then((module) => ({ default: module.Automation })));
const Stickies = lazy(() => import("./stickies/stickies").then((module) => ({ default: module.Stickies })));
const WorkspaceViews = lazy(() =>
  import("./saved-views/workspace-views").then((module) => ({ default: module.WorkspaceViews }))
);
const SavedViews = lazy(() => import("./saved-views/saved-views").then((module) => ({ default: module.SavedViews })));
const Intakes = lazy(() => import("./intakes/intakes").then((module) => ({ default: module.Intakes })));
const Modules = lazy(() => import("./modules/modules").then((module) => ({ default: module.Modules })));
const WorkspaceCycles = lazy(() =>
  import("./cycles/workspace-cycles").then((module) => ({ default: module.WorkspaceCycles }))
);
const Cycles = lazy(() => import("./cycles/cycles").then((module) => ({ default: module.Cycles })));
const TaskCenter = lazy(() => import("./tasks/task-center").then((module) => ({ default: module.TaskCenter })));
const Notifications = lazy(() =>
  import("./notifications/notifications").then((module) => ({ default: module.Notifications }))
);
const Credentials = lazy(() => import("./credentials/credentials").then((module) => ({ default: module.Credentials })));
const Resources = lazy(() => import("./resources/resources").then((module) => ({ default: module.Resources })));
const Reports = lazy(() => import("./reporting/reports").then((module) => ({ default: module.Reports })));
const ProjectOverview = lazy(() =>
  import("./reporting/project-overview").then((module) => ({ default: module.ProjectOverview }))
);
const Clients = lazy(() => import("./commercial/clients").then((module) => ({ default: module.Clients })));
const Opportunities = lazy(() =>
  import("./commercial/opportunities").then((module) => ({ default: module.Opportunities }))
);

const Documents = lazy(() => import("./documents/documents").then((module) => ({ default: module.Documents })));
const WorkspaceSettings = lazy(() =>
  import("./workspace-settings").then((module) => ({ default: module.WorkspaceSettings }))
);
const Assistant = lazy(() => import("./assistant/assistant-module").then((module) => ({ default: module.Assistant })));
const Meetings = lazy(() => import("./meetings/meeting-module").then((module) => ({ default: module.Meetings })));

export function CoreWorkspace() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading)
    return (
      <p role="status" className="p-8">
        Restoring your session…
      </p>
    );
  return isAuthenticated ? (
    <SessionBoundary>
      <Onboarding>
        <Workspace />
      </Onboarding>
    </SessionBoundary>
  ) : (
    <SignIn />
  );
}

function Workspace() {
  const workspaces = useQuery(api.workspaces.index.list);
  const [params, setParams] = useSearchParams();
  const workspace = workspaces?.find((item) => item.slug === params.get("workspace"));
  const { signOut } = useAuthActions();
  const connection = useConvexConnectionState();
  const [error, setError] = useState("");
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-canvas text-primary md:overflow-hidden">
      <header className="flex shrink-0 items-center justify-between border-b border-subtle-1 px-6 py-4">
        <Link to="/core" className="font-semibold">
          Summon Core
        </Link>
        <div className="flex items-center gap-4">
          <span role="status" className="text-12 text-secondary">
            {connection.isWebSocketConnected ? "Live" : "Reconnecting…"}
          </span>
          <Button
            variant="secondary"
            onClick={() => {
              void signOut().catch(() => setError("Could not sign out. Please try again."));
            }}
          >
            Sign out
          </Button>
        </div>
      </header>
      {error && (
        <p role="alert" className="px-6 py-2 text-danger-primary">
          {error}
        </p>
      )}
      <div className="flex flex-1 flex-col md:min-h-0 md:flex-row">
        <aside className="w-full shrink-0 border-b border-subtle-1 p-4 md:w-60 md:overflow-y-auto md:border-r md:border-b-0">
          <h2 className="mb-3 text-12 font-semibold text-secondary">WORKSPACES</h2>
          <nav className="flex flex-col gap-1">
            {workspaces?.map((item) => (
              <button
                key={item._id}
                aria-current={workspace?._id === item._id ? "page" : undefined}
                className="rounded-md px-3 py-2 text-left text-14 hover:bg-layer-2 aria-[current=page]:bg-layer-2"
                onClick={() => setParams({ workspace: item.slug })}
              >
                {item.name}
              </button>
            ))}
          </nav>
          <button className="mt-3 px-3 py-2 text-14 text-accent-primary" onClick={() => setParams({})}>
            Create workspace
          </button>
          {workspace && (
            <MembershipAccessBoundary key={workspace._id} onRecover={() => setParams({})}>
              <WorkspaceNavigation workspace={workspace} />
              <Suspense
                fallback={
                  <p role="status" className="mt-4 text-12 text-secondary">
                    Loading quick links…
                  </p>
                }
              >
                <QuickLinks workspaceId={workspace._id} />
              </Suspense>
              <div className="mt-5 border-t border-subtle-1 pt-3">
                <LeaveMembership scope={{ kind: "workspace", id: workspace._id, name: workspace.name }} />
              </div>
            </MembershipAccessBoundary>
          )}
          <Profile />
        </aside>
        <section className="min-w-0 flex-1 p-6 md:overflow-y-auto">
          {workspaces === undefined ? (
            <p role="status">Loading workspaces…</p>
          ) : workspace ? (
            <MembershipAccessBoundary key={workspace._id} onRecover={() => setParams({})}>
              <WorkspaceModules workspace={workspace} />
            </MembershipAccessBoundary>
          ) : (
            <CreateWorkspace onCreated={(slug) => setParams({ workspace: slug })} />
          )}
        </section>
      </div>
    </div>
  );
}

function Projects({ workspace }: { workspace: FunctionReturnType<typeof api.workspaces.index.list>[number] }) {
  const projects = useQuery(api.projects.index.list, { workspaceId: workspace._id });
  const [params, setParams] = useSearchParams();
  const project = projects?.find((item) => item.identifier === params.get("project"));
  const hasSelectedTask = Boolean(params.get("task"));
  const projectView = params.get("projectView") ?? "tasks";
  const openArchived = () =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      for (const key of ["project", "task", "cycle", "cycleView", "projectModule", "moduleView"]) next.delete(key);
      next.set("projectView", "archived");
      return next;
    });
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1 text-12 text-secondary">{workspace.name}</p>
          <h1 className={hasSelectedTask ? "text-20 font-semibold break-words" : "text-28 font-semibold break-words"}>
            {project ? project.name : "Projects"}
          </h1>
        </div>
        <div className="flex max-w-full flex-wrap items-end gap-2">
          <label className="min-w-0 space-y-1 text-12 text-secondary">
            <span className="block">Project</span>
            <select
              aria-label="Project"
              className="max-w-full rounded-md border border-subtle-1 bg-layer-2 px-3 py-2 text-14 text-primary sm:max-w-64"
              value={project?.identifier ?? ""}
              onChange={(event) => {
                const next = projects?.find((item) => item.identifier === event.target.value);
                setParams(
                  next ? { workspace: workspace.slug, project: next.identifier } : { workspace: workspace.slug }
                );
              }}
            >
              <option value="">Choose project</option>
              {projects?.map((item) => (
                <option key={item._id} value={item.identifier}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          {project && <FavoriteToggle workspaceId={workspace._id} target={{ type: "project", id: project._id }} />}
          <Button variant="secondary" onClick={openArchived}>
            Archived projects
          </Button>
          {workspace.membershipRole === "admin" && (
            <Button variant="secondary" onClick={() => setParams({ workspace: workspace.slug })}>
              New project
            </Button>
          )}
        </div>
      </header>
      {project && (
        <LeaveMembership key={project._id} scope={{ kind: "project", id: project._id, name: project.name }} />
      )}
      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        <ManagedInvitations
          key={workspace._id}
          name={workspace.name}
          scope={{ workspaceId: workspace._id, projectId: null }}
        />
        {project && (
          <ManagedInvitations
            key={project._id}
            name={project.name}
            scope={{ workspaceId: workspace._id, projectId: project._id }}
          />
        )}
      </div>
      {(workspace.membershipRole === "admin" ||
        (project?.membershipRole === "admin" && project.workspaceRole !== "guest")) && (
        <details className="rounded-lg border border-subtle-1 px-3 py-2">
          <summary className="cursor-pointer text-12 font-medium text-secondary">Manage access</summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {workspace.membershipRole === "admin" && (
              <Membership scope={{ kind: "workspace", workspaceId: workspace._id }} />
            )}
            {project?.membershipRole === "admin" && project.workspaceRole !== "guest" && (
              <Membership key={project._id} scope={{ kind: "project", projectId: project._id }} />
            )}
          </div>
        </details>
      )}
      {projects === undefined ? (
        <p role="status">Loading projects…</p>
      ) : projectView === "archived" ? (
        <ArchivedProjects
          workspaceId={workspace._id}
          onRestored={(identifier) =>
            setParams((current) => {
              const next = new URLSearchParams(current);
              next.set("project", identifier);
              next.set("projectView", "settings");
              return next;
            })
          }
        />
      ) : project ? (
        <ProjectBoundary key={project._id} onRecover={openArchived}>
          <div className="space-y-6">
            <RecordVisit workspaceId={workspace._id} target={{ type: "project", id: project._id }} />
            <nav aria-label="Project sections" className="flex flex-wrap gap-2">
              {[
                { value: "tasks", label: "Tasks" },
                { value: "cycles", label: "Cycles" },
                { value: "modules", label: "Modules" },
                { value: "intake", label: "Intake" },
                { value: "views", label: "Views" },
                { value: "settings", label: "Settings" },
              ].map((section) => (
                <Button
                  key={section.value}
                  variant={projectView === section.value ? "primary" : "secondary"}
                  onClick={() =>
                    setParams((current) => {
                      const next = new URLSearchParams(current);
                      next.delete("comment");
                      next.delete("task");
                      next.delete("cycle");
                      next.delete("cycleView");
                      next.delete("projectModule");
                      next.delete("moduleView");
                      next.delete("intake");
                      next.delete("intakeStatus");
                      next.delete("savedView");
                      next.delete("savedViewTab");
                      if (section.value !== "tasks") next.set("projectView", section.value);
                      else next.delete("projectView");
                      return next;
                    })
                  }
                >
                  {section.label}
                </Button>
              ))}
            </nav>
            {projectView === "views" ? (
              <SavedViews key={project._id} project={project} />
            ) : projectView === "intake" ? (
              <Intakes key={project._id} project={project} />
            ) : projectView === "settings" ? (
              <ProjectSettings key={project._id} projectId={project._id} onArchived={openArchived} />
            ) : projectView === "modules" ? (
              <Modules key={project._id} project={project} />
            ) : projectView === "cycles" ? (
              <Cycles key={project._id} project={project} />
            ) : (
              <>
                {!hasSelectedTask && !params.get("taskView") && (
                  <ProjectOverview key={`overview:${project._id}`} projectId={project._id} />
                )}
                <ProjectTasks key={project._id} project={project} />
              </>
            )}
          </div>
        </ProjectBoundary>
      ) : params.get("project") ? (
        <section className="space-y-3">
          <h2 className="text-20 font-semibold">This project is unavailable</h2>
          <p className="text-14 text-secondary">Choose another project or check archived projects.</p>
          <Button variant="secondary" onClick={openArchived}>
            View archived projects
          </Button>
        </section>
      ) : workspace.membershipRole !== "admin" ? (
        <p className="text-14 text-secondary">
          Choose a project. Your workspace administrator can create projects and grant access.
        </p>
      ) : (
        <CreateProject
          workspace={workspace}
          onCreated={(identifier) => setParams({ workspace: workspace.slug, project: identifier })}
        />
      )}
    </div>
  );
}

function CreateProject({
  workspace,
  onCreated,
}: {
  workspace: FunctionReturnType<typeof api.workspaces.index.list>[number];
  onCreated: (identifier: string) => void;
}) {
  const create = useMutation(api.projects.index.create);
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="flex max-w-md flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        try {
          await create({ workspaceId: workspace._id, name, identifier });
          onCreated(identifier.trim().toUpperCase());
        } catch {
          setError("Could not create project. An administrator must choose a unique identifier.");
        } finally {
          setPending(false);
        }
      }}
    >
      <h2 className="font-semibold">Create a project</h2>
      <SummonField label="Project name">
        <Input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} />
      </SummonField>
      <SummonField label="Identifier">
        <Input
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value.toUpperCase())}
          required
          pattern="[A-Z][A-Z0-9]{1,9}"
          placeholder="CORE"
        />
      </SummonField>
      {error && (
        <p role="alert" className="text-danger-primary">
          {error}
        </p>
      )}
      <Button type="submit" loading={pending}>
        Create project
      </Button>
    </form>
  );
}

function WorkspaceModules({ workspace }: { workspace: FunctionReturnType<typeof api.workspaces.index.list>[number] }) {
  const [params] = useSearchParams();
  const module = params.get("module") ?? "projects";
  return (
    <div className="space-y-6">
      <Suspense fallback={<p role="status">Loading module…</p>}>
        {module === "cycles" ? (
          <WorkspaceCycles workspace={workspace} />
        ) : module === "stickies" ? (
          <Stickies key={workspace._id} workspace={workspace} />
        ) : module === "views" ? (
          <WorkspaceViews key={workspace._id} workspace={workspace} />
        ) : module === "tasks" ? (
          <TaskCenter workspace={workspace} />
        ) : module === "automation" ? (
          <Automation workspace={workspace} />
        ) : module === "notifications" ? (
          <Notifications key={workspace._id} workspace={workspace} />
        ) : module === "credentials" ? (
          <Credentials workspace={workspace} />
        ) : module === "resources" ? (
          <Resources workspace={workspace} />
        ) : module === "reports" ? (
          <Reports workspace={workspace} />
        ) : module === "assistant" ? (
          <Assistant workspace={workspace} />
        ) : module === "documents" ? (
          <Documents workspace={workspace} />
        ) : module === "meetings" ? (
          <Meetings workspace={workspace} />
        ) : module === "settings" ? (
          <WorkspaceSettings workspace={workspace} />
        ) : module === "clients" ? (
          <Clients workspace={workspace} />
        ) : module === "opportunities" ? (
          <Opportunities workspace={workspace} />
        ) : (
          <Projects workspace={workspace} />
        )}
      </Suspense>
    </div>
  );
}
