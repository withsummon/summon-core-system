import { Outlet, Link, useParams } from "react-router";
import { createContext, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { NativeCreateProjectModal } from "@/components/project/create-project-modal";
import { SessionBoundary } from "@/components/convex-core/identity/session-boundary";
import { NativeStickiesProvider } from "@/components/stickies/native/provider";
import { NativeStickiesModal } from "@/components/stickies/native/surfaces";
import type { NativeProfile, NativeWorkspace } from "@/components/workspace/native-shell/types";

export type WorkspaceSession = {
  user: NativeProfile;
  workspace: NativeWorkspace;
  workspaces: NativeWorkspace[];
};
export const NativeProjectCreateContext = createContext<(() => void) | null>(null);

export default function NativeWorkspaceLayout() {
  const { workspaceSlug } = useParams();
  return (
    <SessionBoundary>
      <WorkspaceOutlet key={workspaceSlug} />
    </SessionBoundary>
  );
}

function WorkspaceOutlet() {
  const { workspaceSlug } = useParams();
  const [creatingProject, setCreatingProject] = useState<{
    workspaceId: NativeWorkspace["_id"];
    workspaceSlug: string;
  } | null>(null);
  const user = useQuery(api.identity.profile.get, {});
  const workspaces = useQuery(api.workspaces.index.list, {});
  const workspace = workspaces?.find((row) => row.slug === workspaceSlug);
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
  const context: WorkspaceSession | null = workspace ? { user, workspace, workspaces } : null;
  return (
    <NativeProjectCreateContext.Provider value={createProject}>
      {context ? (
        <NativeStickiesProvider
          key={`${user.id}:${context.workspace._id}`}
          workspaceId={context.workspace._id}
          workspaceSlug={context.workspace.slug}
        >
          <Outlet context={context} />
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
