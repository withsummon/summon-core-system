import { completionRoute } from "./route";
import { useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { ProfileForm } from "../profile";
import { CreateWorkspace } from "../../create-workspace";
import { IncomingInvitations } from "../../invitations/incoming";
import { mutationMessage } from "../../commercial/forms";
type Profile = FunctionReturnType<typeof api.identity.profile.get>;
export function Onboarding({ children }: { children: ReactNode }) {
  const profile = useQuery(api.identity.profile.get);
  if (!profile)
    return (
      <p role="status" className="p-8">
        Loading your profile…
      </p>
    );
  return profile.preferences.isOnboarded ? children : <Setup profile={profile} />;
}
function Setup({ profile }: { profile: Profile }) {
  const workspaces = useQuery(api.workspaces.index.list);
  const complete = useMutation(api.identity.onboarding.complete);
  const { signOut } = useAuthActions();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selection, setSelection] = useState<{
    workspace: NonNullable<typeof workspaces>[number];
    revision: number;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 overflow-y-auto p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-24 font-semibold">Welcome to Summon Core</h1>
        <Button
          variant="secondary"
          onClick={() => {
            void signOut().catch((failure) => setError(mutationMessage(failure)));
          }}
        >
          Sign out
        </Button>
      </header>
      <section className="space-y-3 rounded-lg border border-subtle-1 p-4">
        <h2 className="text-18 font-medium">1. Review your profile</h2>
        <p className="break-words">{profile.displayName || "Your account"}</p>
        <p className="break-all text-secondary">{profile.email}</p>
        {editing ? (
          <ProfileForm initial={profile} onClose={() => setEditing(false)} />
        ) : (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit profile
          </Button>
        )}
      </section>
      <section className="space-y-3 rounded-lg border border-subtle-1 p-4">
        <h2 className="text-18 font-medium">2. Choose a workspace</h2>
        <IncomingInvitations />
        {workspaces === undefined ? (
          <p role="status">Loading workspaces…</p>
        ) : (
          <ul className="space-y-2">
            {workspaces.map((workspace) => (
              <li key={workspace._id}>
                <Button
                  variant="secondary"
                  disabled={pending || editing}
                  onClick={() => {
                    setSelection({ workspace, revision: profile.revision });
                    setError("");
                  }}
                >
                  Use {workspace.name}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button variant="secondary" onClick={() => setCreating(!creating)}>
          {creating ? "Close workspace form" : "Create a workspace"}
        </Button>
        {creating && <CreateWorkspace onCreated={() => setCreating(false)} />}
      </section>
      {selection && (
        <section className="space-y-3">
          <p>Continue to {selection.workspace.name} with this profile?</p>
          <div className="flex flex-wrap gap-2">
            <Button
              loading={pending}
              disabled={editing}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  const destination = await complete({
                    workspaceId: selection.workspace._id,
                    expectedRevision: selection.revision,
                  });
                  setParams(completionRoute(params, selection.workspace.slug, destination.slug));
                } catch (failure) {
                  setError(mutationMessage(failure));
                } finally {
                  setPending(false);
                }
              }}
            >
              Finish setup
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setSelection(null)}>
              Cancel
            </Button>
          </div>
        </section>
      )}
      {error && (
        <p role="alert" className="text-danger-primary">
          {error}
        </p>
      )}
    </main>
  );
}
