import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { mutationMessage } from "../commercial/forms";
type Detail = FunctionReturnType<typeof api.intakes.index.resolve>;
type Status = FunctionArgs<typeof api.intakes.index.decide>["status"];
export const intakeDecisions = {
  pending: { value: "pending", label: "Pending" },
  accepted: { value: "accepted", label: "Accepted" },
  rejected: { value: "rejected", label: "Rejected" },
  snoozed: { value: "snoozed", label: "Snoozed" },
  duplicate: { value: "duplicate", label: "Duplicate" },
} as const satisfies { [S in Status]: { value: S; label: string } };
export const intakeOptions = Object.values(intakeDecisions);
export function DecisionForm({ detail, onClose }: { detail: Detail; onClose: () => void }) {
  const [snapshot] = useState(detail);
  const [status, setStatus] = useState<Status | null>(null),
    [date, setDate] = useState("");
  const [duplicateTask, setDuplicateTask] = useState<
    FunctionReturnType<typeof api.tasks.index.list>["page"][number] | null
  >(null);
  const decide = useMutation(api.intakes.index.decide);
  const tasks = usePaginatedQuery(
    api.tasks.index.list,
    status === "duplicate" ? { projectId: detail.task.projectId } : "skip",
    { initialNumItems: 50 }
  );
  const choices =
    duplicateTask && !tasks.results.some((task) => task._id === duplicateTask._id)
      ? [duplicateTask, ...tasks.results]
      : tasks.results;
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const continuation = useRef<(() => void) | null>(null);
  const leave = useCallback(() => {
    continuation.current = null;
  }, []);
  const release = useReloadConfirmations(status !== null || pending, "Your intake decision has not been saved.", leave);
  useEffect(() => leave, [leave]);
  return (
    <form
      className="space-y-3 rounded-lg border border-subtle-1 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!status) return;
        continuation.current = onClose;
        setPending(true);
        setError("");
        try {
          await decide({
            taskId: snapshot.task._id,
            expectedUpdatedAt: snapshot.intake.updatedAt,
            expectedTaskUpdatedAt: snapshot.task.updatedAt,
            status,
            snoozedUntil: status === "snoozed" ? new Date(date).getTime() : null,
            duplicateTo: status === "duplicate" ? (duplicateTask?._id ?? null) : null,
          });
        } catch (failure) {
          if (continuation.current !== null) setError(mutationMessage(failure));
          continuation.current = null;
          return;
        } finally {
          setPending(false);
        }
        release(() => {
          const close = continuation.current;
          continuation.current = null;
          close?.();
        });
      }}
    >
      <h3 className="text-16 font-medium">Review submission</h3>
      <fieldset disabled={pending} className="space-y-3">
        <SummonField label="Intake decision" htmlFor="intake-decision">
          <select
            id="intake-decision"
            required
            className="w-full rounded-md border border-subtle-1 bg-layer-2 p-2 text-14"
            value={status ?? ""}
            onChange={(e) => setStatus(intakeOptions.find((option) => option.value === e.target.value)?.value ?? null)}
          >
            <option value="">Choose decision</option>
            {intakeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </SummonField>
        {status === "accepted" && (
          <p className="text-14 text-secondary">
            {snapshot.task.status === "triage"
              ? "Accept this submission into the project’s default workflow state. Its task ID and identifier stay the same."
              : "Mark this submission accepted. The existing project task keeps its current workflow state."}
          </p>
        )}
        {status === "snoozed" && (
          <SummonField label="Snooze until (local time)">
            <Input type="datetime-local" required value={date} onChange={(e) => setDate(e.target.value)} />
          </SummonField>
        )}
        {status === "duplicate" && (
          <div className="space-y-2">
            <SummonField label="Duplicate of" htmlFor="intake-duplicate">
              <select
                id="intake-duplicate"
                required
                className="w-full rounded-md border border-subtle-1 bg-layer-2 p-2 text-14"
                value={duplicateTask?._id ?? ""}
                onChange={(e) => setDuplicateTask(choices.find((task) => task._id === e.target.value) ?? null)}
              >
                <option value="">Choose project task</option>
                {choices
                  .filter((task) => task._id !== snapshot.task._id)
                  .map((task) => (
                    <option key={task._id} value={task._id}>
                      #{task.sequence} · {task.title}
                    </option>
                  ))}
              </select>
            </SummonField>
            {tasks.status === "CanLoadMore" && (
              <Button variant="secondary" onClick={() => tasks.loadMore(50)}>
                Load more tasks
              </Button>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="text-14 text-danger-primary">
            {error}
          </p>
        )}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending} disabled={!status || (status === "duplicate" && !duplicateTask)}>
          Confirm decision
        </Button>
        <Button variant="secondary" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
export function RemoveSubmission({
  detail,
  pending,
  disabled,
  onConfirm,
}: {
  detail: Detail;
  pending: boolean;
  disabled: boolean;
  onConfirm: (snapshot: Detail) => void;
}) {
  const [snapshot, setSnapshot] = useState<Detail | null>(null);
  return (
    <section className="space-y-3 border-t border-subtle-1 pt-4">
      {snapshot ? (
        <>
          <p className="text-14">
            {snapshot.intake.status === "accepted"
              ? "Remove this submission from intake? The accepted project task stays available."
              : "Remove this submission and hide its task? You can recover this removal from intake trash."}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" loading={pending} disabled={disabled} onClick={() => onConfirm(snapshot)}>
              Confirm remove
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setSnapshot(null)}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <Button variant="secondary" disabled={pending || disabled} onClick={() => setSnapshot(detail)}>
          Remove submission
        </Button>
      )}
    </section>
  );
}
