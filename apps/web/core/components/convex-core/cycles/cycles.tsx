import { useSearchParams } from "react-router";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { ProjectCycles } from "./list";
import { CycleDetails } from "./detail";
import { CycleForm } from "./forms";
import { Button } from "@plane/propel/button";

// The prototype entry uses the same preserved journey as the project routes.
export function Cycles({ project }: { project: FunctionReturnType<typeof api.projects.index.list>[number] }) {
  const address = useQuery(api.navigation.address.resolveProjectId, {
    workspaceId: project.workspaceId,
    projectId: project._id,
  });
  const [params, setParams] = useSearchParams();
  const selected = params.get("cycle");
  const create = () =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set("createCycle", "1");
      return next;
    });
  const close = () =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("createCycle");
      return next;
    });
  if (!address) return <p role="status">Loading cycles…</p>;
  return (
    <>
      <header className="flex justify-end gap-2 pb-3">
        {selected ? (
          <Button
            variant="secondary"
            onClick={() =>
              setParams((current) => {
                const next = new URLSearchParams(current);
                next.delete("cycle");
                return next;
              })
            }
          >
            Back to cycles
          </Button>
        ) : (
          address.projectRole !== "guest" &&
          address.workspaceRole !== "guest" && <Button onClick={create}>Add cycle</Button>
        )}
      </header>
      {selected ? (
        <CycleDetails address={address} cycleId={selected} />
      ) : (
        <ProjectCycles
          address={address}
          view={params.get("cycleView") === "trash" ? "trash" : "all"}
          onCreate={create}
        />
      )}
      {params.has("createCycle") && (
        <CycleForm
          projectId={project._id}
          cycle={null}
          canSave={address.projectRole !== "guest" && address.workspaceRole !== "guest"}
          onDone={close}
          onCancel={close}
        />
      )}
    </>
  );
}
