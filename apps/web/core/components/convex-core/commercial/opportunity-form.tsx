import { useId, useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
import type { Doc, Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { OPPORTUNITY_STAGES, OPPORTUNITY_STAGE_LABEL } from "@/components/summon/opportunities/opportunity-pipeline";
import { OwnerField } from "./owner-field";
import { ClientField } from "./client-field";
import { cardClass, field, mutationMessage, selectClass } from "./forms";

const newOpportunity = {
  title: "",
  product: "",
  source: "",
  description: "",
  stage: "lead",
  value: null,
  probability: 0,
  expectedCloseDate: null,
  clientId: null,
  ownerId: null,
} satisfies FunctionArgs<typeof api.commercial.opportunities.save>["data"];
export function OpportunityForm({
  workspaceId,
  opportunity,
  onDone,
  onCancel,
}: {
  workspaceId: Id<"workspaces">;
  opportunity: Doc<"opportunities"> | null;
  onDone: (id: Id<"opportunities">) => void;
  onCancel: () => void;
}) {
  const fieldId = useId();
  const save = useMutation(api.commercial.opportunities.save);
  const initial = opportunity ?? newOpportunity;
  const [ownerId, setOwnerId] = useState(initial.ownerId);
  const [clientId, setClientId] = useState(initial.clientId);
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
          const stage = OPPORTUNITY_STAGES.find((value) => value === field(form, "stage"));
          if (!stage) throw new Error("Invalid stage");
          const id = await save({
            workspaceId,
            opportunityId: opportunity?._id,
            data: {
              title: field(form, "title"),
              product: field(form, "product"),
              source: field(form, "source"),
              description: field(form, "description"),
              stage,
              value: field(form, "value") || null,
              probability: Number(field(form, "probability")),
              expectedCloseDate: field(form, "expectedCloseDate") || null,
              clientId,
              ownerId,
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
      <h2 className="font-semibold sm:col-span-2">{opportunity ? "Edit opportunity" : "Add opportunity"}</h2>
      <SummonField label="Opportunity title">
        <Input name="title" defaultValue={initial.title} required maxLength={255} />
      </SummonField>
      <ClientField workspaceId={workspaceId} value={clientId} onChange={setClientId} />
      <SummonField label="Product or service">
        <Input name="product" defaultValue={initial.product} maxLength={255} />
      </SummonField>
      <SummonField label="Source">
        <Input name="source" defaultValue={initial.source} maxLength={120} />
      </SummonField>
      <SummonField label="Stage" htmlFor={fieldId}>
        <select id={fieldId} name="stage" className={selectClass} defaultValue={initial.stage}>
          {OPPORTUNITY_STAGES.map((value) => (
            <option key={value} value={value}>
              {OPPORTUNITY_STAGE_LABEL[value]}
            </option>
          ))}
        </select>
      </SummonField>
      <SummonField label="Value">
        <Input
          name="value"
          inputMode="decimal"
          defaultValue={initial.value ?? ""}
          pattern="-?[0-9]{1,16}(\.[0-9]{1,2})?"
          placeholder="0.00"
        />
      </SummonField>
      <SummonField label="Probability (%)">
        <Input
          name="probability"
          type="number"
          min={0}
          max={100}
          step={1}
          required
          defaultValue={initial.probability}
        />
      </SummonField>
      <SummonField label="Expected close">
        <Input name="expectedCloseDate" type="date" defaultValue={initial.expectedCloseDate ?? ""} />
      </SummonField>
      <OwnerField workspaceId={workspaceId} value={ownerId} onChange={setOwnerId} />
      <div className="sm:col-span-2">
        <SummonField label="Description">
          <textarea
            name="description"
            defaultValue={initial.description}
            rows={4}
            maxLength={100000}
            className={selectClass}
          />
        </SummonField>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger-primary sm:col-span-2">
          {error}
        </p>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" loading={pending}>
          Save opportunity
        </Button>
        <Button variant="secondary" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
