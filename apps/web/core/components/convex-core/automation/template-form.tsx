import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@summon/convex/api";
import type { Doc, Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { DeleteRecord, field, mutationMessage, selectClass } from "../commercial/forms";
export function TemplateForm({
  workspaceId,
  template,
  onDone,
}: {
  workspaceId: Id<"workspaces">;
  template: Doc<"automationTemplates"> | null;
  onDone: () => void;
}) {
  const save = useMutation(api.automation.templates.save);
  const remove = useMutation(api.automation.templates.remove);
  const [initial] = useState(template);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="max-w-3xl space-y-5">
      <header>
        <h2 className="text-24 font-semibold">{initial ? "Edit template" : "New template"}</h2>
      </header>
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setPending(true);
          setError("");
          try {
            await save({
              workspaceId,
              templateId: initial?._id,
              expectedRevision: initial?.revision,
              name: field(form, "name"),
              type: field(form, "type"),
              description: field(form, "description"),
              contentTemplate: field(form, "instructions"),
              variables: field(form, "variables")
                .split("\n")
                .map((v) => v.trim())
                .filter(Boolean),
              isActive: form.get("active") === "on",
            });
            onDone();
          } catch (failure) {
            setError(mutationMessage(failure));
          } finally {
            setPending(false);
          }
        }}
      >
        <fieldset disabled={pending} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SummonField label="Template name">
              <Input name="name" defaultValue={initial?.name ?? ""} required maxLength={255} />
            </SummonField>
            <SummonField label="Document type">
              <Input name="type" defaultValue={initial?.type ?? "brief"} required maxLength={80} />
            </SummonField>
          </div>
          <SummonField label="Description">
            <Input name="description" defaultValue={initial?.description ?? ""} maxLength={10000} />
          </SummonField>
          <SummonField label="Instructions">
            <textarea
              name="instructions"
              className={`${selectClass} w-full`}
              rows={12}
              defaultValue={initial?.contentTemplate ?? ""}
              required
              maxLength={30000}
            />
          </SummonField>
          <SummonField label="Input fields (one per line)">
            <textarea
              name="variables"
              className={`${selectClass} w-full`}
              rows={4}
              defaultValue={initial?.variables.join("\n") ?? ""}
            />
          </SummonField>
          <label className="flex gap-2 text-14">
            <input type="checkbox" name="active" defaultChecked={initial?.isActive ?? true} />
            Available for new previews
          </label>
          <div className="flex gap-2">
            <Button type="submit" loading={pending}>
              Save template
            </Button>
            <Button variant="secondary" onClick={onDone}>
              Cancel
            </Button>
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="text-14 text-danger-primary">
            {error}
          </p>
        )}
      </form>
      {initial && (
        <DeleteRecord
          label="template"
          onDelete={async () => {
            await remove({ templateId: initial._id, expectedRevision: initial.revision });
            onDone();
          }}
        />
      )}
    </div>
  );
}
