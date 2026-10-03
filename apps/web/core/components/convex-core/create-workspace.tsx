import { useId, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
export function CreateWorkspace({ onCreated }: { onCreated: (slug: string) => void }) {
  const nameId = useId(),
    slugId = useId();
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
      <SummonField label="Workspace name" htmlFor={nameId}>
        <Input id={nameId} value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} />
      </SummonField>
      <SummonField label="Workspace slug" htmlFor={slugId}>
        <Input
          id={slugId}
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
