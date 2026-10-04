import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Doc, Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { ProjectSettingsLabelList } from "@/components/labels/project-setting-label-list";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { mutationMessage } from "../commercial/forms";

export function LabelManagement({ projectId }: { projectId: Id<"projects"> }) {
  const settings = useQuery(api.tasks.labels.settings, { projectId });
  const step = useMutation(api.tasks.label_removal.step),
    cancel = useMutation(api.tasks.label_removal.cancel);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  useReloadConfirmations(pending, "Label cleanup is still running.", undefined, pending);
  const run = async (jobId: Id<"labelRemovalJobs">, kind: "step" | "cancel") => {
    if (pending || !settings?.canManage) return;
    setPending(true);
    setError("");
    try {
      if (kind === "step") await step({ jobId });
      else await cancel({ jobId });
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  };
  return (
    <>
      <ProjectSettingsLabelList projectId={projectId} settings={settings} />
      <RemovalJobs projectId={projectId} canManage={settings?.canManage === true} pending={pending} run={run} />
      {error && (
        <p role="alert" className="text-13 text-danger-primary">
          {error}
        </p>
      )}
    </>
  );
}
function RemovalJobs({
  projectId,
  canManage,
  pending,
  run,
}: {
  projectId: Id<"projects">;
  canManage: boolean;
  pending: boolean;
  run: (jobId: Id<"labelRemovalJobs">, kind: "step" | "cancel") => Promise<void>;
}) {
  const jobs = usePaginatedQuery(api.tasks.label_removal.list, canManage ? { projectId } : "skip", {
    initialNumItems: 10,
  });
  return (
    <div className="space-y-2">
      {jobs.results.map((job) => (
        <RemovalJob key={job._id} job={job} pending={pending} run={run} />
      ))}
      {jobs.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => jobs.loadMore(10)}>
          Load more label deletions
        </Button>
      )}
    </div>
  );
}
function RemovalJob({
  job,
  pending,
  run,
}: {
  job: Doc<"labelRemovalJobs">;
  pending: boolean;
  run: (jobId: Id<"labelRemovalJobs">, kind: "step" | "cancel") => Promise<void>;
}) {
  return (
    <div className="space-y-2 rounded-md border border-subtle-1 p-3 text-14">
      <p>
        {job.name} · {job.status}
      </p>
      {job.status === "running" && (
        <>
          <p>
            {job.changed} references removed · Next: {job.phase}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button loading={pending} onClick={() => run(job._id, "step")}>
              Continue deletion
            </Button>
            {!job.started && (
              <Button variant="secondary" disabled={pending} onClick={() => run(job._id, "cancel")}>
                Cancel deletion
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
