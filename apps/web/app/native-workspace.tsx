import { Outlet, Link, useParams, useMatch, useSearchParams, useNavigate } from "react-router";
import { lazy, Suspense, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { ComponentProps } from "react";
import type { Id } from "@summon/convex/data-model";
import { NativeCreateProjectModal } from "@/components/project/create-project-modal";
import { SessionBoundary } from "@/components/convex-core/identity/session-boundary";
import { NativeStickiesProvider } from "@/components/stickies/native/provider";
import { NativeStickiesModal } from "@/components/stickies/native/surfaces";
import {
  NativeTaskActionContext,
  NativeProjectCreateContext,
  NativeTaskCreateContext,
} from "@/components/workspace/native-shell/session";
import type { NativeWorkspace, WorkspaceSession } from "@/components/workspace/native-shell/session";

const TaskActionComposer = lazy(() =>
  import("@/components/convex-core/tasks/task-detail").then((module) => ({ default: module.TaskActionComposer }))
);
const CreateWorkspaceIssue = lazy(() =>
  import("@/components/convex-core/tasks/task-detail").then((module) => ({ default: module.CreateWorkspaceIssue }))
);
const DocumentAccessBoundary = lazy(() =>
  import("@/components/convex-core/documents/editor").then((module) => ({ default: module.DocumentAccessBoundary }))
);
export default function NativeWorkspaceLayout() {
  const { workspaceSlug } = useParams();
  const page = useMatch("/:workspaceSlug/projects/:projectId/pages/:pageId");
  const documents = useMatch("/:workspaceSlug/summon/documents");
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const documentId = page?.params.pageId ?? (documents ? search.get("document") : null);
  return (
    <SessionBoundary>
      {documentId ? (
        <Suspense
          fallback={
            <p role="status" className="p-6">
              Opening document…
            </p>
          }
        >
          <DocumentAccessBoundary
            key={`${workspaceSlug}:${documentId}`}
            documentId={documentId}
            onBack={() => {
              if (page) navigate(`/${workspaceSlug}/projects/${page.params.projectId}/pages/`);
              else setSearch({});
            }}
            unavailableTitle={page ? "Page not found" : "This document is unavailable"}
            backLabel={page ? "View other Pages" : "Back to documents"}
          >
            <WorkspaceOutlet key={workspaceSlug} documentId={documentId} />
          </DocumentAccessBoundary>
        </Suspense>
      ) : (
        <WorkspaceOutlet key={workspaceSlug} />
      )}
    </SessionBoundary>
  );
}

function WorkspaceOutlet({ documentId }: { documentId?: string }) {
  const { workspaceSlug } = useParams();
  const [creatingProject, setCreatingProject] = useState<{
    workspaceId: NativeWorkspace["_id"];
    workspaceSlug: string;
  } | null>(null);
  const [taskAction, setTaskAction] = useState<ComponentProps<typeof TaskActionComposer>["request"] | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const taskCommands = useMemo(
    () => (taskId: Id<"tasks">, kind: "edit" | "copy") =>
      setTaskAction({ taskId, kind, requestId: crypto.randomUUID() }),
    []
  );
  const user = useQuery(api.identity.profile.get, {});
  const workspaces = useQuery(api.workspaces.index.list, {});
  const workspace = workspaces?.find((row) => row.slug === workspaceSlug);
  const projects = useQuery(api.projects.index.list, workspace ? { workspaceId: workspace._id } : "skip");
  const canCreateTask =
    projects?.some((project) => project.membershipRole !== "guest" && project.workspaceRole !== "guest") === true;
  const createTask = useMemo(() => (canCreateTask ? () => setCreatingTask(true) : null), [canCreateTask]);
  const createProject = useMemo(
    () =>
      workspace && workspace.membershipRole !== "guest"
        ? () => setCreatingProject({ workspaceId: workspace._id, workspaceSlug: workspace.slug })
        : null,
    [workspace]
  );
  if (!user || !workspaces)
    return (
      <p role="status" className="p-6">
        Loading workspace…
      </p>
    );
  if (!workspace && documentId) throw new Error("This workspace is unavailable");
  const context: WorkspaceSession | null = workspace ? { user, workspace, workspaces } : null;
  return (
    <NativeProjectCreateContext.Provider value={createProject}>
      {context ? (
        <NativeStickiesProvider
          key={`${user.id}:${context.workspace._id}`}
          workspaceId={context.workspace._id}
          workspaceSlug={context.workspace.slug}
        >
          <NativeTaskActionContext.Provider value={taskCommands}>
            <NativeTaskCreateContext.Provider value={createTask}>
              <Outlet context={context} />
              {creatingTask && (
                <Suspense fallback={<p role="status">Opening work item composer…</p>}>
                  <CreateWorkspaceIssue workspaceId={context.workspace._id} onClose={() => setCreatingTask(false)} />
                </Suspense>
              )}
            </NativeTaskCreateContext.Provider>
            {taskAction && (
              <Suspense fallback={<p role="status">Opening work item composer…</p>}>
                <TaskActionComposer
                  key={taskAction.requestId}
                  request={taskAction}
                  workspaceId={context.workspace._id}
                  onClose={() => setTaskAction(null)}
                />
              </Suspense>
            )}
          </NativeTaskActionContext.Provider>
          <NativeStickiesModal />
        </NativeStickiesProvider>
      ) : (
        <section className="space-y-4 p-8">
          <h1 className="text-24 font-semibold">This workspace is unavailable</h1>
          <p>Your membership may have changed. Choose an available workspace.</p>
          <nav aria-label="Available workspaces" className="flex flex-col gap-2">
            {workspaces.map((row) => (
              <Link key={row._id} className="text-accent-primary" to={`/${row.slug}/stickies/`}>
                {row.name}
              </Link>
            ))}
          </nav>
        </section>
      )}
      {creatingProject && <NativeCreateProjectModal {...creatingProject} onClose={() => setCreatingProject(null)} />}
    </NativeProjectCreateContext.Provider>
  );
}
