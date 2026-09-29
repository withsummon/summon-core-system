import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
import type { Doc, Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { Dialog, EDialogWidth } from "@plane/propel/dialog";
import { DatePicker } from "@plane/propel/date-picker";
import { SummonField } from "@/components/summon/forms";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { useCycleClock } from "./use-cycle-clock";
import { mutationMessage } from "../commercial/forms";
export function CycleForm({
  projectId,
  cycle,
  canSave,
  currentRevision,
  onDone,
  onCancel,
}: {
  projectId: Id<"projects">;
  cycle: Doc<"cycles"> | null;
  canSave: boolean;
  currentRevision?: number;
  onDone: (id: Id<"cycles">, allowDefaultNavigation: boolean) => void;
  onCancel: (allowDefaultNavigation: boolean) => void;
}) {
  const create = useMutation(api.cycles.index.create);
  const update = useMutation(api.cycles.index.update);
  const [initial] = useState(cycle);
  const {
    register,
    watch,
    setValue,
    reset,
    handleSubmit,
    formState: { isDirty, isSubmitting },
  } = useForm<Pick<FunctionArgs<typeof api.cycles.index.create>, "name" | "description" | "startDate" | "endDate">>({
    defaultValues: initial
      ? {
          name: initial.name,
          description: initial.description,
          startDate: initial.startDate,
          endDate: initial.endDate,
        }
      : { name: "", description: "", startDate: null, endDate: null },
  });
  const [discarding, setDiscarding] = useState(false);
  const [error, setError] = useState("");
  const leave = useCallback(() => {
    reset();
    onCancel(false);
  }, [reset, onCancel]);
  const release = useReloadConfirmations(
    isDirty || isSubmitting,
    "This cycle has unsaved changes.",
    leave,
    isSubmitting
  );
  const dismiss = () => {
    if (isSubmitting) return;
    if (isDirty) setDiscarding(true);
    else onCancel(true);
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) dismiss();
      }}
    >
      <Dialog.Panel position="top" width={EDialogWidth.XXL}>
        <form
          aria-busy={isSubmitting}
          onSubmit={handleSubmit(async (fields) => {
            if (!canSave) return;
            setError("");
            try {
              let id: Id<"cycles">;
              if (initial) {
                await update({ cycleId: initial._id, expectedUpdatedAt: initial.updatedAt, ...fields });
                id = initial._id;
              } else id = await create({ projectId, ...fields });
              reset(fields);
              release((allow) => onDone(id, allow));
            } catch (failure) {
              setError(mutationMessage(failure));
            }
          })}
        >
          <div className="space-y-3 p-5">
            <Dialog.Title className="pb-2 text-18 font-medium text-secondary">
              {initial ? "Update cycle" : "Create cycle"}
            </Dialog.Title>
            <fieldset disabled={isSubmitting} className="space-y-3">
              <SummonField label="Cycle name" htmlFor="cycle-name">
                <Input id="cycle-name" required maxLength={255} placeholder="Title" {...register("name")} />
              </SummonField>
              <SummonField label="Description" htmlFor="cycle-description">
                <textarea
                  id="cycle-description"
                  rows={3}
                  maxLength={10000}
                  {...register("description")}
                  placeholder="Description"
                  className="min-h-24 w-full resize-none rounded-md border border-subtle-1 bg-layer-2 p-3 text-14"
                />
              </SummonField>
              <div className="grid gap-3 sm:grid-cols-2">
                <SummonField label="Start date" htmlFor="cycle-start-date">
                  <DatePicker
                    id="cycle-start-date"
                    max={watch("endDate") ?? undefined}
                    value={watch("startDate") ?? ""}
                    onValueChange={(value) => setValue("startDate", value || null, { shouldDirty: true })}
                    placeholder="Start date"
                  />
                </SummonField>
                <SummonField label="End date" htmlFor="cycle-end-date">
                  <DatePicker
                    id="cycle-end-date"
                    min={watch("startDate") ?? undefined}
                    value={watch("endDate") ?? ""}
                    onValueChange={(value) => setValue("endDate", value || null, { shouldDirty: true })}
                    placeholder="End date"
                  />
                </SummonField>
              </div>
              <p className="text-12 text-secondary">Set both dates, or leave both empty for a draft cycle.</p>
            </fieldset>
            {!canSave && (
              <p role="status" className="text-13 text-secondary">
                Saving is unavailable. Your changes are preserved.
              </p>
            )}
            {initial && currentRevision !== undefined && currentRevision !== initial.updatedAt && (
              <p role="status" className="text-13 text-secondary">
                This cycle changed elsewhere. Reopen it before saving; your changes are preserved.
              </p>
            )}
            {error && (
              <p role="alert" className="text-14 text-danger-primary">
                {error}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-subtle px-5 py-4">
            <Button variant="secondary" disabled={isSubmitting} onClick={dismiss}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={!canSave}>
              {initial ? "Update cycle" : "Create cycle"}
            </Button>
          </div>
        </form>
        <Dialog open={discarding} onOpenChange={setDiscarding}>
          <Dialog.Panel width={EDialogWidth.SM}>
            <div className="space-y-3 p-5">
              <Dialog.Title>Discard cycle changes?</Dialog.Title>
              <Dialog.Description className="text-13 text-secondary">
                Your unsaved changes will be lost.
              </Dialog.Description>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setDiscarding(false)}>
                  Keep editing
                </Button>
                <Button
                  variant="error-fill"
                  onClick={() => {
                    reset();
                    release(onCancel);
                  }}
                >
                  Discard
                </Button>
              </div>
            </div>
          </Dialog.Panel>
        </Dialog>
      </Dialog.Panel>
    </Dialog>
  );
}
export function CycleEdit({
  cycle,
  canWrite,
  onClose,
}: {
  cycle: Doc<"cycles">;
  canWrite: boolean;
  onClose: () => void;
}) {
  const [now] = useCycleClock();
  const live = useQuery(api.cycles.index.get, { cycleId: cycle._id, now });
  return (
    <CycleForm
      projectId={cycle.projectId}
      cycle={cycle}
      currentRevision={live?.updatedAt}
      canSave={canWrite && live?.canEdit === true}
      onDone={onClose}
      onCancel={onClose}
    />
  );
}
export function ProjectTimezone({ projectId }: { projectId: Id<"projects"> }) {
  const settings = useQuery(api.projects.timezone.get, { projectId });
  const [editing, setEditing] = useState(false);
  if (!settings) return <p role="status">Loading project timezone…</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-12 text-secondary">
          New cycles use {settings.timezone}. Existing cycles retain their timezone.
        </p>
        {settings.canManage && (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit project timezone
          </Button>
        )}
      </div>
      {editing && settings.canManage && (
        <TimezoneForm projectId={projectId} initial={settings.timezone} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}
function TimezoneForm({
  projectId,
  initial,
  onClose,
}: {
  projectId: Id<"projects">;
  initial: string;
  onClose: () => void;
}) {
  const save = useMutation(api.projects.timezone.save);
  const [expectedTimezone] = useState(initial);
  const [timezone, setTimezone] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="max-w-md space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError("");
        try {
          await save({ projectId, timezone, expectedTimezone });
          onClose();
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <SummonField label="Project timezone">
        <Input required value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Asia/Jakarta" />
      </SummonField>
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          Save timezone
        </Button>
        <Button variant="secondary" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </form>
  );
}
