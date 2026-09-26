import { useId, useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
import type { Doc, Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { OwnerField } from "./owner-field";
import { cardClass, field, mutationMessage, selectClass } from "./forms";

const newClient = {
  name: "",
  companyName: "",
  industry: "",
  email: "",
  phone: "",
  website: "",
  headOffice: "",
  relationshipStartedAt: null,
  notes: "",
  status: "lead",
  ownerId: null,
  externalSource: null,
  externalId: null,
} satisfies FunctionArgs<typeof api.commercial.clients.save>["data"];
const statuses = ["lead", "active", "inactive"] as const satisfies readonly Doc<"clients">["status"][];
export function ClientForm({
  workspaceId,
  client,
  onDone,
  onCancel,
}: {
  workspaceId: Id<"workspaces">;
  client: Doc<"clients"> | null;
  onDone: (id: Id<"clients">) => void;
  onCancel: () => void;
}) {
  const fieldId = useId();
  const save = useMutation(api.commercial.clients.save);
  const initial = client ?? newClient;
  const [ownerId, setOwnerId] = useState(initial.ownerId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className={`${cardClass} grid gap-4 sm:grid-cols-2`}
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setError("");
        try {
          const status = statuses.find((value) => value === field(form, "status"));
          if (!status) throw new Error("Invalid status");
          const id = await save({
            workspaceId,
            clientId: client?._id,
            data: {
              name: field(form, "name"),
              companyName: field(form, "companyName"),
              industry: field(form, "industry"),
              email: field(form, "email"),
              phone: field(form, "phone"),
              website: field(form, "website"),
              headOffice: field(form, "headOffice"),
              relationshipStartedAt: field(form, "relationshipStartedAt") || null,
              notes: field(form, "notes"),
              status,
              ownerId,
              externalSource: field(form, "externalSource") || null,
              externalId: field(form, "externalId") || null,
            },
          });
          onDone(id);
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <h2 className="font-semibold sm:col-span-2">{client ? "Edit client" : "Add client"}</h2>
      <SummonField label="Client name">
        <Input name="name" defaultValue={initial.name} required maxLength={255} />
      </SummonField>
      <SummonField label="Legal company name">
        <Input name="companyName" defaultValue={initial.companyName} maxLength={255} />
      </SummonField>
      <SummonField label="Industry">
        <Input name="industry" defaultValue={initial.industry} maxLength={120} />
      </SummonField>
      <SummonField label="Status" htmlFor={fieldId}>
        <select id={fieldId} name="status" className={selectClass} defaultValue={initial.status}>
          {statuses.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </SummonField>
      <SummonField label="Client email">
        <Input name="email" type="email" defaultValue={initial.email} maxLength={254} />
      </SummonField>
      <SummonField label="Client phone">
        <Input name="phone" defaultValue={initial.phone} maxLength={40} />
      </SummonField>
      <SummonField label="Website">
        <Input name="website" type="url" defaultValue={initial.website} maxLength={200} />
      </SummonField>
      <SummonField label="Head office">
        <Input name="headOffice" defaultValue={initial.headOffice} maxLength={255} />
      </SummonField>
      <SummonField label="Relationship started">
        <Input name="relationshipStartedAt" type="date" defaultValue={initial.relationshipStartedAt ?? ""} />
      </SummonField>
      <OwnerField workspaceId={workspaceId} value={ownerId} onChange={setOwnerId} />
      <div className="sm:col-span-2">
        <SummonField label="Relationship notes">
          <textarea name="notes" defaultValue={initial.notes} rows={4} maxLength={100000} className={selectClass} />
        </SummonField>
      </div>
      <details className="sm:col-span-2">
        <summary className="text-sm cursor-pointer">External reference</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <SummonField label="External source">
            <Input name="externalSource" defaultValue={initial.externalSource ?? ""} maxLength={255} />
          </SummonField>
          <SummonField label="External ID">
            <Input name="externalId" defaultValue={initial.externalId ?? ""} maxLength={255} />
          </SummonField>
        </div>
      </details>
      {error && (
        <p role="alert" className="text-sm text-danger-primary sm:col-span-2">
          {error}
        </p>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" loading={pending}>
          Save client
        </Button>
        <Button variant="secondary" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
