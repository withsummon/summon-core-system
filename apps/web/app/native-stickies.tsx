import { lazy, Suspense, useState } from "react";
import { Link, useParams } from "react-router";
import { useConvexAuth, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { CoreProvider } from "@/components/convex-core/provider";
import { SignIn } from "@/components/convex-core/sign-in";
const Stickies = lazy(() =>
  import("@/components/convex-core/stickies/stickies").then((module) => ({ default: module.Stickies }))
);
export default function NativeStickiesRoute() {
  return (
    <CoreProvider>
      <Session />
    </CoreProvider>
  );
}
function Session() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading)
    return (
      <p role="status" className="p-6">
        Loading your account…
      </p>
    );
  // Sign in in place: the original path, sticky selection and history survive.
  // No cookie/JWT bridging or caller-controlled redirect is involved.
  return isAuthenticated ? <WorkspaceNotes /> : <SignIn />;
}
function WorkspaceNotes() {
  const { workspaceSlug } = useParams();
  if (!workspaceSlug) throw new Error("Workspace route parameter is missing.");
  const user = useQuery(api.identity.index.current, {});
  const result = useQuery(api.navigation.address.resolveWorkspace, { workspaceSlug });
  const { signOut } = useAuthActions();
  const [error, setError] = useState("");
  if (!result || !user)
    return (
      <p role="status" className="p-6">
        Loading workspace…
      </p>
    );
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle-1 pb-4">
        <Link
          to={`/core?${new URLSearchParams({ workspace: result.workspace.slug })}`}
          className="text-14 font-medium text-accent-primary"
        >
          {result.workspace.name}
        </Link>
        <Button
          variant="secondary"
          onClick={() => {
            void signOut().catch(() => setError("Could not sign out. Please try again."));
          }}
        >
          Sign out
        </Button>
      </header>
      {error && (
        <p role="alert" className="text-danger-primary">
          {error}
        </p>
      )}
      <Suspense fallback={<p role="status">Loading stickies…</p>}>
        <Stickies key={`${user.id}:${result.workspace._id}`} workspace={result.workspace} />
      </Suspense>
    </main>
  );
}
