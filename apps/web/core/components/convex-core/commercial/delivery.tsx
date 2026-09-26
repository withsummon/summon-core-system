import { useId, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "react-router";
import { api } from "@summon/convex/api";
import type { Doc } from "@summon/convex/data-model";
import type { FunctionReturnType } from "convex/server";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { cardClass, field, mutationMessage, selectClass } from "./forms";

export function Delivery({
  opportunity,
  workspace,
}: {
  opportunity: Doc<"opportunities">;
  workspace: FunctionReturnType<typeof api.workspaces.index.list>[number];
}) {
  const linked = useQuery(api.commercial.delivery.getForOpportunity, {
    workspaceId: workspace._id,
    opportunityId: opportunity._id,
  });
  const [, setParams] = useSearchParams();
  if (linked === undefined) return <p role="status">Loading delivery…</p>;
  if (linked)
    return (
      <section className={cardClass}>
        <h2 className="font-semibold">Delivery project</h2>
        <p className="text-sm my-3">
          {linked.project.identifier} · {linked.project.name}
        </p>
        <Button onClick={() => setParams({ workspace: workspace.slug, project: linked.project.identifier })}>
          Open delivery project
        </Button>
      </section>
    );
  if (opportunity.stage !== "won")
    return (
      <section className={cardClass}>
        <h2 className="font-semibold">Delivery project</h2>
        <p className="text-sm mt-2 text-secondary">Mark this opportunity as won to start delivery.</p>
      </section>
    );
  if (!opportunity.clientId)
    return (
      <section className={cardClass}>
        <h2 className="font-semibold">Delivery project</h2>
        <p className="text-sm mt-2 text-secondary">
          Edit this opportunity to choose its client before starting delivery.
        </p>
      </section>
    );
  if (workspace.membershipRole === "guest")
    return <p className="text-sm text-secondary">Ask a project administrator to start delivery.</p>;
  return <DeliveryStart opportunity={opportunity} workspace={workspace} />;
}
function DeliveryStart({
  opportunity,
  workspace,
}: {
  opportunity: Doc<"opportunities">;
  workspace: FunctionReturnType<typeof api.workspaces.index.list>[number];
}) {
  const projects = useQuery(api.projects.index.list, { workspaceId: workspace._id });
  const fieldId = useId();
  const start = useMutation(api.commercial.delivery.start);
  const [requestedMode, setMode] = useState<"create" | "existing">("existing");
  const mode = workspace.membershipRole === "admin" ? requestedMode : "existing";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const available = projects?.filter(
    (project) => project.membershipRole === "admin" && project.workspaceRole !== "guest"
  );
  return (
    <section className={`${cardClass} space-y-3`}>
      <h2 className="font-semibold">Start delivery</h2>
      <p className="text-sm text-secondary">Create a delivery project or link a project you administer.</p>
      <div className="flex flex-wrap gap-2">
        {workspace.membershipRole === "admin" && (
          <Button variant={mode === "create" ? "primary" : "secondary"} onClick={() => setMode("create")}>
            Create project
          </Button>
        )}
        <Button variant={mode === "existing" ? "primary" : "secondary"} onClick={() => setMode("existing")}>
          Link existing project
        </Button>
      </div>
      <form
        className="grid max-w-lg gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setPending(true);
          setError("");
          try {
            if (mode === "create") {
              await start({
                workspaceId: workspace._id,
                opportunityId: opportunity._id,
                target: { kind: "create", name: field(form, "name"), identifier: field(form, "identifier") },
              });
            } else {
              const project = available?.find((item) => item._id === field(form, "projectId"));
              if (!project) throw new Error("Choose an available project");
              await start({
                workspaceId: workspace._id,
                opportunityId: opportunity._id,
                target: { kind: "existing", projectId: project._id },
              });
            }
          } catch (failure) {
            setError(mutationMessage(failure));
          } finally {
            setPending(false);
          }
        }}
      >
        {mode === "create" ? (
          <>
            <SummonField label="Delivery project name">
              <Input name="name" required maxLength={120} defaultValue={opportunity.title} />
            </SummonField>
            <SummonField label="Delivery project identifier">
              <Input name="identifier" required pattern="[A-Za-z][A-Za-z0-9]{1,9}" placeholder="DELIVERY" />
            </SummonField>
          </>
        ) : (
          <SummonField label="Project to link" htmlFor={fieldId}>
            <select id={fieldId} name="projectId" className={selectClass} required defaultValue="">
              <option value="">Choose a project</option>
              {available?.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.identifier} · {project.name}
                </option>
              ))}
            </select>
          </SummonField>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger-primary">
            {error}
          </p>
        )}
        <Button type="submit" loading={pending}>
          {mode === "create" ? "Create delivery project" : "Link delivery project"}
        </Button>
      </form>
    </section>
  );
}
