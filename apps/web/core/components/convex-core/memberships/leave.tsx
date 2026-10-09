import { useState } from "react";
import { useMutation } from "convex/react";
import { useNavigate } from "react-router";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { mutationMessage } from "../commercial/forms";
type LeaveScope =
  | { kind: "workspace"; id: Id<"workspaces">; name: string }
  | { kind: "project"; id: Id<"projects">; name: string };
export function LeaveMembership({ scope }: { scope: LeaveScope }) {
  const leaveWorkspace = useMutation(api.workspaces.index.leave);
  const leaveProject = useMutation(api.projects.index.leave);
  const navigate = useNavigate();
  const [confirmation, setConfirmation] = useState<LeaveScope | null>(null);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function leave() {
    if (!confirmation) return;
    setPending(true);
    setError("");
    try {
      if (confirmation.kind === "workspace") {
        await leaveWorkspace({ workspaceId: confirmation.id });
        await navigate("/core", { replace: true });
      } else {
        const { workspaceSlug } = await leaveProject({ projectId: confirmation.id });
        await navigate(`/core?${new URLSearchParams({ workspace: workspaceSlug })}`, { replace: true });
      }
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="min-w-0 space-y-3 text-14">
      {confirmation ? (
        <div className="min-w-0 space-y-3 rounded-md border border-subtle-1 p-3">
          <h3 className="font-medium break-words">Leave {confirmation.name}?</h3>
          <p className="text-secondary">
            {confirmation.kind === "workspace"
              ? "You will lose access to this workspace and all its projects, including archived projects."
              : "You will lose access to this project. Your workspace membership stays active."}{" "}
            Existing content stays. You need a new invitation or membership grant to return.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button loading={pending} onClick={() => void leave()}>
              Confirm leave {confirmation.kind}
            </Button>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setConfirmation(null);
                setError("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="secondary"
          onClick={() => {
            setError("");
            setConfirmation(scope);
          }}
        >
          Leave {scope.kind}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}
