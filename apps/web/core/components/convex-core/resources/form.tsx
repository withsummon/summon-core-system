import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import type { FunctionReturnType } from "convex/server";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage } from "../commercial/forms";
import { associationOptions, selectedAssociation } from "./associations";
type ResourceDetail = FunctionReturnType<typeof api.resources.index.detail>;
const selectClass = "w-full rounded-md border border-subtle-1 bg-layer-2 px-3 py-2 text-14";
function Association<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T | null;
  options: Array<{ id: T; name: string }>;
  onChange: (value: T | null) => void;
  disabled: boolean;
}) {
  return (
    <SummonField label={label}>
      <select
        className={selectClass}
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => onChange(selectedAssociation(event.target.value, options))}
      >
        <option value="">None</option>
        {options.map((option) => (
          <option value={option.id} key={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </SummonField>
  );
}
export function ResourceForm({
  workspaceId,
  detail,
  onDone,
  onCancel,
}: {
  workspaceId: Id<"workspaces">;
  detail: ResourceDetail | null;
  onDone: (id: Id<"resources">) => void;
  onCancel: () => void;
}) {
  const [baseline] = useState(detail);
  const resource = baseline?.resource;
  const changed = Boolean(resource && detail?.resource.updatedAt !== resource.updatedAt);
  const projects = useQuery(api.projects.index.list, { workspaceId });
  const documents = usePaginatedQuery(api.resources.index.documentOptions, { workspaceId }, { initialNumItems: 50 });
  const clients = usePaginatedQuery(api.commercial.clients.list, { workspaceId }, { initialNumItems: 50 });
  const credentials = usePaginatedQuery(api.mcp.credentials.list, { workspaceId }, { initialNumItems: 50 });
  const [preserveCredential, setPreserveCredential] = useState(resource?.credentialUnavailable ?? false);
  const [credentialId, setCredential] = useState(resource?.credentialId ?? null);
  const [projectId, setProject] = useState(resource?.projectId ?? null);
  const [documentId, setDocument] = useState(resource?.documentId ?? null);
  const [clientId, setClient] = useState(resource?.clientId ?? null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const create = useMutation(api.resources.index.create);
  const update = useMutation(api.resources.index.update);
  return (
    <form
      className="max-w-3xl space-y-4 rounded-xl border border-subtle-1 p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const fields = {
          title: String(form.get("title")),
          url: String(form.get("url")),
          description: String(form.get("description")),
          category: String(form.get("category")),
          projectId,
          documentId,
          clientId,
          credentialId: preserveCredential ? undefined : credentialId,
        };
        setPending(true);
        setError("");
        try {
          if (resource) {
            await update({ resourceId: resource._id, expectedUpdatedAt: resource.updatedAt, ...fields });
            onDone(resource._id);
          } else onDone(await create({ workspaceId, ...fields }));
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <h2 className="text-18 font-semibold">{resource ? "Edit resource" : "New resource"}</h2>
      <fieldset disabled={pending || changed} className="space-y-4">
        <SummonField label="Title">
          <Input name="title" defaultValue={resource?.title ?? ""} required maxLength={255} />
        </SummonField>
        <SummonField label="URL">
          <Input
            name="url"
            type="url"
            defaultValue={resource?.url ?? ""}
            placeholder="https://"
            required
            maxLength={2048}
          />
        </SummonField>
        <SummonField label="Description">
          <textarea
            className={selectClass}
            name="description"
            defaultValue={resource?.description ?? ""}
            rows={4}
            maxLength={10000}
          />
        </SummonField>
        <SummonField label="Category">
          <Input
            name="category"
            defaultValue={resource?.category ?? ""}
            maxLength={80}
            placeholder="Design, repository, reference…"
          />
        </SummonField>
        <div className="grid gap-4 sm:grid-cols-2">
          <Association
            label="Project"
            value={projectId}
            onChange={setProject}
            disabled={!projects}
            options={associationOptions(
              projects
                ?.filter((item) => item.membershipRole !== "guest" && item.workspaceRole !== "guest")
                .map((item) => ({ id: item._id, name: item.name })) ?? [],
              resource?.projectId ?? null,
              detail?.projectName ?? null
            )}
          />
          <Association
            label="Document"
            value={documentId}
            onChange={setDocument}
            disabled={documents.status === "LoadingFirstPage"}
            options={associationOptions(documents.results, resource?.documentId ?? null, detail?.documentName ?? null)}
          />
          <Association
            label="Client"
            value={clientId}
            onChange={setClient}
            disabled={clients.status === "LoadingFirstPage"}
            options={associationOptions(
              clients.results.map((item) => ({ id: item._id, name: item.name })),
              resource?.clientId ?? null,
              detail?.clientName ?? null
            )}
          />
          {resource?.credentialUnavailable && (
            <label className="flex items-center gap-2 text-14">
              <input
                type="checkbox"
                checked={preserveCredential}
                onChange={(event) => setPreserveCredential(event.target.checked)}
              />
              Keep existing inaccessible credential association
            </label>
          )}
          {!preserveCredential && (
            <Association
              label="Credential"
              value={credentialId}
              onChange={setCredential}
              disabled={credentials.status === "LoadingFirstPage"}
              options={associationOptions(
                credentials.results.map((item) => ({ id: item._id, name: item.name })),
                resource?.credentialId ?? null,
                detail?.resource.credentialName ?? null
              )}
            />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {credentials.status === "CanLoadMore" && (
            <Button type="button" variant="secondary" onClick={() => credentials.loadMore(50)}>
              Load more credentials
            </Button>
          )}
          {documents.status === "CanLoadMore" && (
            <Button type="button" variant="secondary" onClick={() => documents.loadMore(50)}>
              Load more documents
            </Button>
          )}
          {clients.status === "CanLoadMore" && (
            <Button type="button" variant="secondary" onClick={() => clients.loadMore(50)}>
              Load more clients
            </Button>
          )}
        </div>
      </fieldset>
      {changed && (
        <p role="alert" className="text-14 text-danger-primary">
          This resource changed while you were editing. Cancel and reopen to use the latest version.
        </p>
      )}
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="submit"
          loading={pending}
          disabled={
            changed || !projects || documents.status === "LoadingFirstPage" || clients.status === "LoadingFirstPage"
          }
        >
          Save resource
        </Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
