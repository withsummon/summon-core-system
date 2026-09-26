import { useId, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
import type { Doc, Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { cardClass, field, mutationMessage, selectClass } from "../commercial/forms";

const newDocument = {
  name: "",
  access: "private",
  isGlobal: false,
  projectIds: [],
  color: "",
  viewProps: {},
  logoProps: {},
  sortOrder: 0,
  category: "document",
  tags: [],
  clientId: null,
  opportunityId: null,
  externalId: null,
  externalSource: null,
} satisfies Omit<FunctionArgs<typeof api.documents.index.create>, "workspaceId">;
export function MetadataForm({
  workspaceId,
  document,
  canManage,
  onDone,
  onCancel,
}: {
  workspaceId: Id<"workspaces">;
  document: Doc<"documents"> | null;
  canManage: boolean;
  onDone: (id: Id<"documents">) => void;
  onCancel: () => void;
}) {
  const create = useMutation(api.documents.index.create);
  const update = useMutation(api.documents.index.update);
  const projects = useQuery(api.projects.index.list, { workspaceId });
  const initial = document ?? newDocument;
  const [visibility, setVisibility] = useState(
    initial.access === "private" ? "private" : initial.isGlobal ? "workspace" : "projects"
  );
  const [projectIds, setProjectIds] = useState<Id<"projects">[]>(initial.projectIds);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const visibilityId = useId();
  return (
    <form
      className={`${cardClass} grid gap-4 sm:grid-cols-2`}
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setError("");
        try {
          const metadata = {
            name: field(form, "name"),
            access: visibility === "private" ? ("private" as const) : ("public" as const),
            isGlobal: visibility === "private" ? initial.isGlobal : visibility === "workspace",
            projectIds,
            category: field(form, "category"),
            tags: field(form, "tags")
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
            color: initial.color,
            viewProps: initial.viewProps,
            logoProps: initial.logoProps,
            sortOrder: initial.sortOrder,
            clientId: initial.clientId,
            opportunityId: initial.opportunityId,
            externalId: initial.externalId,
            externalSource: initial.externalSource,
          };
          if (document) {
            await update({ documentId: document._id, ...metadata });
            onDone(document._id);
          } else {
            const id = await create({ workspaceId, ...metadata });
            onDone(id);
          }
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <h2 className="font-semibold sm:col-span-2">{document ? "Document settings" : "New document"}</h2>
      <SummonField label="Document name">
        <Input name="name" required maxLength={255} defaultValue={initial.name} readOnly={document !== null} />
      </SummonField>
      <SummonField label="Category">
        <Input name="category" maxLength={80} defaultValue={initial.category} />
      </SummonField>
      <SummonField label="Visibility" htmlFor={visibilityId}>
        <select
          id={visibilityId}
          className={selectClass}
          value={visibility}
          disabled={!canManage}
          onChange={(event) => setVisibility(event.target.value)}
        >
          <option value="private">Private · only you</option>
          <option value="workspace">Workspace members</option>
          <option value="projects">Selected projects</option>
        </select>
      </SummonField>
      <SummonField label="Tags (comma separated)">
        <Input name="tags" defaultValue={initial.tags.join(", ")} />
      </SummonField>
      {visibility === "projects" && (
        <fieldset className="space-y-2 sm:col-span-2" disabled={!canManage}>
          <legend className="text-sm mb-2 font-medium">Projects</legend>
          {projects
            ?.filter((project) => project.membershipRole !== "guest" && project.workspaceRole !== "guest")
            .map((project) => (
              <label key={project._id} className="text-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={projectIds.includes(project._id)}
                  onChange={(event) =>
                    setProjectIds((ids) =>
                      event.target.checked ? [...ids, project._id] : ids.filter((id) => id !== project._id)
                    )
                  }
                />
                {project.name}
              </label>
            ))}
        </fieldset>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger-primary sm:col-span-2">
          {error}
        </p>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" loading={pending}>
          Save document
        </Button>
        <Button variant="secondary" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
