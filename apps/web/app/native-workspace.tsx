import { Outlet, Link, useParams, useLocation } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { SessionBoundary } from "@/components/convex-core/identity/session-boundary";
import { NativeStickiesProvider } from "@/components/stickies/native/provider";
import { NativeStickiesModal } from "@/components/stickies/native/surfaces";
import type { NativeProfile, NativeWorkspace } from "@/components/workspace/native-shell/types";

export type WorkspaceSession = {
  user: NativeProfile;
  workspace: NativeWorkspace;
  workspaces: NativeWorkspace[];
};

export default function NativeWorkspaceLayout() {
  return (
    <SessionBoundary>
      <WorkspaceOutlet />
    </SessionBoundary>
  );
}

function WorkspaceOutlet() {
  const { workspaceSlug } = useParams();
  const { pathname } = useLocation();
  const user = useQuery(api.identity.profile.get, {});
  const workspaces = useQuery(api.workspaces.index.list, {});
  if (!user || !workspaces)
    return (
      <p role="status" className="p-6">
        Loading workspace…
      </p>
    );
  const workspace = workspaces.find((row) => row.slug === workspaceSlug);
  if (!workspace)
    return (
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
    );
  const context: WorkspaceSession = { user, workspace, workspaces };
  return (
    <NativeStickiesProvider
      key={`${user.id}:${workspace._id}:${pathname}`}
      workspaceId={workspace._id}
      workspaceSlug={workspace.slug}
    >
      <Outlet context={context} />
      <NativeStickiesModal />
    </NativeStickiesProvider>
  );
}
