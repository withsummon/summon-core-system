import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { ProjectStateRoot } from "@/components/project-states/root";
import { LabelManagement } from "./label-management";

export function ProjectTaxonomy({ projectId }: { projectId: Id<"projects"> }) {
  const project = useQuery(api.projects.features.get, { projectId });
  return (
    <details className="rounded-lg border border-subtle-1 p-4">
      <summary className="cursor-pointer text-14 font-medium">Project states & labels</summary>
      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <section className="space-y-3">
          <h3 className="text-14 font-medium">Workflow states</h3>
          {project && <ProjectStateRoot project={{ projectId, ...project }} />}
        </section>
        <LabelManagement projectId={projectId} />
      </div>
    </details>
  );
}
