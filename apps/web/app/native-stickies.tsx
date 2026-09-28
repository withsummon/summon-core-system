import { Link, useParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { SessionBoundary } from "@/components/convex-core/identity/session-boundary";
import { NativeStickiesProvider, useStickiesCommands } from "@/components/stickies/native/provider";
import { NativeStickiesPage, NativeStickiesModal } from "@/components/stickies/native/surfaces";
import { PreservedStickiesShell } from "@/components/workspace/native-shell/stickies-shell";
import type { FunctionReturnType } from "convex/server";

type Workspace = FunctionReturnType<typeof api.workspaces.index.list>[number];
type Profile = FunctionReturnType<typeof api.identity.profile.get>;

export default function NativeStickiesRoute() {
  return (
    <SessionBoundary>
      <WorkspaceNotes />
    </SessionBoundary>
  );
}
function WorkspaceNotes() {
  const { workspaceSlug } = useParams();
  const user = useQuery(api.identity.profile.get, {});
  // The actual switcher consumes this directory too; no second workspace-resolution request.
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
  return (
    <NativeStickiesProvider
      key={`${user.id}:${workspace._id}`}
      workspaceId={workspace._id}
      workspaceSlug={workspace.slug}
    >
      <WorkspaceShell user={user} workspace={workspace} workspaces={workspaces} />
    </NativeStickiesProvider>
  );
}
function WorkspaceShell({
  user,
  workspace,
  workspaces,
}: {
  user: Profile;
  workspace: Workspace;
  workspaces: Workspace[];
}) {
  const commands = useStickiesCommands();
  return (
    <PreservedStickiesShell
      user={user}
      workspace={workspace}
      workspaces={workspaces}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
      <NativeStickiesPage />
      <NativeStickiesModal />
    </PreservedStickiesShell>
  );
}
