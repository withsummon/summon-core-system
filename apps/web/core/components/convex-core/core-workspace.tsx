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
  return isAuthenticated ? <Workspace /> : <SignIn />;
}

function Workspace() {
  const workspaces = useQuery(api.workspaces.index.list);
  const identity = useQuery(api.identity.index.current);
  const [params, setParams] = useSearchParams();
  const workspace = workspaces?.find((item) => item.slug === params.get("workspace"));
  const { signOut } = useAuthActions();
  const connection = useConvexConnectionState();
  const [error, setError] = useState("");
  return (
    <div className="flex h-full flex-col bg-canvas text-primary">
      <header className="flex items-center justify-between border-b border-subtle-1 px-6 py-4">
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
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="w-full shrink-0 border-b border-subtle-1 p-4 md:w-60 md:border-r md:border-b-0">
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
          <details className="mt-6 border-t border-subtle-1 pt-4 text-14">
            <summary className="cursor-pointer">Account details</summary>
            {identity && (
              <div className="mt-3 space-y-2">
                <p className="break-all text-secondary">{identity.email}</p>
                <p className="text-12 text-secondary">Your user ID</p>
                <code className="block text-12 break-all select-all">{identity.id}</code>
              </div>
            )}
          </details>
        </aside>
        <section className="min-w-0 flex-1 overflow-y-auto p-6">
          {workspaces === undefined ? (
            <p role="status">Loading workspaces…</p>
          ) : workspace ? (
            <WorkspaceModules key={workspace._id} workspace={workspace} />
          ) : (
            <CreateWorkspace onCreated={(slug) => setParams({ workspace: slug })} />
          )}
        </section>
      </div>
    </div>
  );
}

function CreateWorkspace({ onCreated }: { onCreated: (slug: string) => void }) {
  const create = useMutation(api.workspaces.index.create);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
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
          await create({ name, slug });
          onCreated(slug);
        } catch {
          setError("Could not create workspace. Check the name and choose a unique slug.");
        } finally {
          setPending(false);
        }
      }}
    >
      <h1 className="text-24 font-semibold">Create a workspace</h1>
      <SummonField label="Workspace name">
        <Input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} />
      </SummonField>
      <SummonField label="Workspace slug">
        <Input
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          required
          maxLength={80}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          placeholder="my-team"
        />
      </SummonField>
      {error && (
        <p role="alert" className="text-danger-primary">
          {error}
        </p>
      )}
      <Button type="submit" loading={pending}>
        Create workspace
      </Button>
    </form>
  );
}

function Projects({ workspace }: { workspace: FunctionReturnType<typeof api.workspaces.index.list>[number] }) {
  const projects = useQuery(api.projects.index.list, { workspaceId: workspace._id });
  const [params, setParams] = useSearchParams();
  const project = projects?.find((item) => item.identifier === params.get("project"));
  const hasSelectedTask = Boolean(params.get("task"));
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
          {workspace.membershipRole === "admin" && (
            <Button variant="secondary" onClick={() => setParams({ workspace: workspace.slug })}>
              New project
            </Button>
          )}
        </div>
      </header>
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
      ) : project ? (
        <div className="space-y-6">
          {!hasSelectedTask && <ProjectOverview key={`overview:${project._id}`} projectId={project._id} />}
          <ProjectTasks key={project._id} project={project} />
        </div>
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
  const [params, setParams] = useSearchParams();
  const module = params.get("module") ?? "projects";
  return (
    <div className="space-y-6">
      <nav aria-label="Workspace modules" className="flex flex-wrap gap-2 border-b border-subtle-1 pb-4">
        {[
          { id: "projects", label: "Projects" },
          { id: "clients", label: "Clients" },
          { id: "opportunities", label: "Opportunities" },
          { id: "documents", label: "Documents" },
          { id: "resources", label: "Resources" },
          { id: "credentials", label: "Credentials" },
          { id: "meetings", label: "Meetings" },
          { id: "assistant", label: "Assistant" },
          { id: "reports", label: "Reports" },
          { id: "settings", label: "Settings" },
        ].map((item) => (
          <Button
            key={item.id}
            variant={module === item.id ? "primary" : "secondary"}
            onClick={() => setParams({ workspace: workspace.slug, module: item.id })}
          >
            {item.label}
          </Button>
        ))}
      </nav>
      <Suspense fallback={<p role="status">Loading module…</p>}>
        {module === "credentials" ? (
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
