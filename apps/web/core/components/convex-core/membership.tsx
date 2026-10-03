import { useState } from "react";
import { useConvex, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Doc, Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";

const roles = ["guest", "member", "admin"] as const satisfies readonly Doc<"projectMembers">["role"][];

export function ProjectMembership({ projectId }: { projectId: Id<"projects"> }) {
  const client = useConvex();
  const grantProject = useMutation(api.projects.index.grantMember);
  const revokeProject = useMutation(api.projects.index.revokeMember);
  const [userId, setUserId] = useState("");
  const [target, setTarget] = useState<FunctionReturnType<typeof api.projects.index.resolveMember> | null>(null);
  const [role, setRole] = useState<Doc<"projectMembers">["role"]>("member");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function changeAccess(operation: "grant" | "revoke") {
    if (!target) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      if (operation === "grant") await grantProject({ projectId, userId: target.id, role });
      else await revokeProject({ projectId, userId: target.id });
      setMessage(operation === "grant" ? `${role} access saved.` : "Access revoked.");
    } catch {
      setError(
        "Could not change access. Check your permissions, workspace membership, and that another administrator remains."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <details className="max-w-xl rounded-lg border border-subtle-1 p-4">
      <summary className="cursor-pointer text-14 font-medium">Manage project access</summary>
      <div className="mt-4 space-y-4">
        <p className="text-14 text-secondary">
          Ask the person to share their user ID from Account details. Project access also requires workspace membership.
        </p>
        <form
          className="flex flex-col gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setTarget(null);
            setError("");
            setMessage("");
            try {
              const user = await client.query(api.projects.index.resolveMember, {
                projectId,
                userId: userId.trim(),
              });
              setTarget(user);
            } catch {
              setError("User not found or unavailable. Check the ID and required workspace membership.");
            } finally {
              setPending(false);
            }
          }}
        >
          <SummonField label="User ID">
            <Input
              disabled={pending}
              value={userId}
              onChange={(event) => {
                setUserId(event.target.value);
                setTarget(null);
                setMessage("");
              }}
              required
            />
          </SummonField>
          <Button type="submit" loading={pending} className="self-start">
            Find user
          </Button>
        </form>
        {target && (
          <div className="space-y-3">
            <p className="text-14">
              {target.name || target.email || "User"}
              <span className="font-mono mt-1 block text-12 break-all text-secondary">{target.id}</span>
            </p>
            <SummonField label="Access role">
              <select
                className="rounded-md border border-subtle-1 bg-layer-2 p-2 text-14"
                value={role}
                disabled={pending}
                onChange={(event) => {
                  const selected = roles.find((value) => value === event.target.value);
                  if (selected) setRole(selected);
                }}
              >
                {roles.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </SummonField>
            <div className="flex flex-wrap gap-2">
              <Button loading={pending} onClick={() => void changeAccess("grant")}>
                Save access
              </Button>
              <Button variant="secondary" disabled={pending} onClick={() => void changeAccess("revoke")}>
                Revoke access
              </Button>
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="text-14 text-danger-primary">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="text-14 text-secondary">
            {message}
          </p>
        )}
      </div>
    </details>
  );
}
