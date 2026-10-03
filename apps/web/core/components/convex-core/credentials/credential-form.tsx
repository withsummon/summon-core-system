import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage } from "../commercial/forms";
export function CredentialForm({
  workspaceId,
  credential,
  onDone,
  onCancel,
}: {
  workspaceId: Id<"workspaces">;
  credential: FunctionReturnType<typeof api.mcp.credentials.get> | null;
  onDone: (id: Id<"mcpCredentials">) => void;
  onCancel: () => void;
}) {
  const projects = useQuery(api.projects.index.list, { workspaceId });
  const create = useAction(api.mcp.vault.create);
  const update = useMutation(api.mcp.credentials.update);
  const [draft, setDraft] = useState<Omit<FunctionArgs<typeof api.mcp.credentials.update>, "credentialId">>({
    name: credential?.name ?? "",
    accountIdentifier: credential?.accountIdentifier ?? "",
    projectId: credential?.projectId ?? null,
    remoteWorkspaceSlug: credential?.remoteWorkspaceSlug ?? "",
    remoteProjectId: credential?.remoteProjectId ?? null,
    expectedRevision: credential?.revision ?? 0,
  });
  const [secret, setSecret] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="max-w-xl space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        try {
          if (credential) {
            await update({ credentialId: credential._id, ...draft });
            onDone(credential._id);
          } else {
            const { expectedRevision: _revision, ...metadata } = draft;
            const id = await create({ workspaceId, ...metadata, secret });
            setSecret("");
            onDone(id);
          }
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <h2 className="text-20 font-semibold">{credential ? "Edit credential" : "New credential"}</h2>
      <SummonField label="Name">
        <Input
          required
          maxLength={255}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </SummonField>
      <SummonField label="Account">
        <Input
          maxLength={255}
          value={draft.accountIdentifier}
          onChange={(e) => setDraft({ ...draft, accountIdentifier: e.target.value })}
        />
      </SummonField>
      <SummonField label="Project" htmlFor="credential-project">
        <select
          id="credential-project"
          className="w-full rounded-md border border-subtle-1 bg-layer-2 px-3 py-2 text-14"
          value={draft.projectId ?? ""}
          onChange={(e) => {
            const project = projects?.find((p) => p._id === e.target.value);
            setDraft({
              ...draft,
              projectId: project?._id ?? null,
              remoteProjectId: project ? (draft.remoteProjectId ?? "") : null,
            });
          }}
        >
          <option value="">Workspace credential</option>
          {projects
            ?.filter((p) => p.membershipRole !== "guest" && p.workspaceRole !== "guest")
            .map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
        </select>
      </SummonField>
      <SummonField label="Remote workspace slug">
        <Input
          required
          maxLength={255}
          pattern="[a-zA-Z0-9_-]+"
          value={draft.remoteWorkspaceSlug}
          onChange={(e) => setDraft({ ...draft, remoteWorkspaceSlug: e.target.value })}
        />
      </SummonField>
      {draft.projectId && (
        <SummonField label="Remote project ID">
          <Input
            required
            maxLength={255}
            pattern="[a-zA-Z0-9_-]+"
            value={draft.remoteProjectId ?? ""}
            onChange={(e) => setDraft({ ...draft, remoteProjectId: e.target.value })}
          />
        </SummonField>
      )}
      {!credential && (
        <SummonField label="Secret">
          <Input
            type="password"
            autoComplete="new-password"
            required
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
        </SummonField>
      )}
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          {credential ? "Save credential" : "Create credential"}
        </Button>
        <Button variant="secondary" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
