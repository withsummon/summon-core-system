import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Plus } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Dialog, EDialogWidth } from "@plane/propel/dialog";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { TaskNonStateProperties, type NonStatePropertyValues } from "../tasks/task-properties";
import { TaskRichEditor } from "../tasks/rich-editor";
import { mutationMessage } from "../commercial/forms";
type Detail = FunctionReturnType<typeof api.intakes.index.resolve>;
const priorities = ["none", "urgent", "high", "medium", "low"] as const satisfies FunctionArgs<
  typeof api.intakes.index.submit
>["priority"][];
export function SubmissionForm({
  projectId,
  initial,
  onDone,
  onCancel,
  disabled = false,
}: {
  projectId: Id<"projects">;
  initial: Detail | null;
  onDone: (id: Id<"tasks">) => void;
  onCancel?: () => void;
  disabled?: boolean;
}) {
  const submit = useMutation(api.intakes.index.submit),
    edit = useMutation(api.intakes.index.edit);
  const [snapshot] = useState(initial);
  const [open, setOpen] = useState(false);
  const config = useQuery(api.intakes.index.getConfig, { projectId });
  const {
    title: defaultTitle,
    priority: defaultPriority,
    assigneeIds,
    labelIds,
    startDate,
    targetDate,
    estimatePointId,
  } = snapshot?.task ??
  ({
    title: "",
    priority: "none",
    assigneeIds: [],
    labelIds: [],
    startDate: null,
    targetDate: null,
    estimatePointId: null,
  } satisfies NonStatePropertyValues & Pick<FunctionArgs<typeof api.intakes.index.submit>, "title">);
  const {
    handleSubmit,
    register,
    watch,
    setValue,
    reset,
    setError,
    formState: { isDirty, isSubmitting, errors },
  } = useForm({
    defaultValues: {
      title: defaultTitle,
      html: snapshot?.html ?? "<p></p>",
      properties: { priority: defaultPriority, assigneeIds, labelIds, startDate, targetDate, estimatePointId },
    },
  });
  const canEditProperties = snapshot ? snapshot.canEditProperties : config?.canEditProperties;
  const continuation = useRef<typeof onDone | null>(null);
  const leave = useCallback(() => {
    continuation.current = null;
  }, []);
  const release = useReloadConfirmations(
    isDirty || isSubmitting,
    "The submission has unsaved changes or is still saving.",
    leave
  );
  useEffect(() => leave, [leave]);
  const cancel = () => {
    if (isSubmitting) return;
    continuation.current = null;
    reset();
    setOpen(false);
    onCancel?.();
  };
  const form = (
    <form
      className="max-w-3xl space-y-4"
      onSubmit={handleSubmit(async ({ title, html, properties }) => {
        if (!snapshot && !config) return;
        continuation.current = onDone;
        try {
          const { priority, ...additional } = properties;
          let id: Id<"tasks">;
          if (snapshot) {
            await edit({
              taskId: snapshot.task._id,
              expectedUpdatedAt: snapshot.intake.updatedAt,
              expectedTaskUpdatedAt: snapshot.task.updatedAt,
              title,
              ...(snapshot.canEditProperties ? { priority, properties: additional } : {}),
            });
            id = snapshot.task._id;
          } else
            id = await submit({
              projectId,
              title,
              html,
              priority,
              ...(canEditProperties ? { properties: additional } : {}),
            });
          reset();
          setOpen(false);
          release((allow) => {
            const complete = continuation.current;
            continuation.current = null;
            // Editing closes its local form; only creation chooses a default URL destination.
            if (snapshot || allow) complete?.(id);
          });
        } catch (failure) {
          if (continuation.current !== null) setError("root", { type: "server", message: mutationMessage(failure) });
          continuation.current = null;
        }
      })}
    >
      <fieldset disabled={isSubmitting} className="space-y-4">
        {snapshot && <h2 className="text-20 font-semibold">Edit submission</h2>}
        <SummonField label="Submission title" htmlFor="intake-title">
          <Input id="intake-title" required maxLength={255} {...register("title")} />
        </SummonField>
        {canEditProperties ? (
          <TaskNonStateProperties
            projectId={projectId}
            draft={watch("properties")}
            onChange={(properties) => setValue("properties", properties, { shouldDirty: true })}
          />
        ) : (
          !snapshot && (
            <SummonField label="Submission priority" htmlFor="intake-priority">
              <select
                id="intake-priority"
                className="rounded-md border border-subtle-1 bg-layer-2 p-2 text-14 capitalize"
                value={watch("properties.priority")}
                onChange={(e) => {
                  const next = priorities.find((value) => value === e.target.value);
                  if (next) setValue("properties.priority", next, { shouldDirty: true });
                }}
              >
                {priorities.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </SummonField>
          )
        )}
        {!snapshot && (
          <TaskRichEditor
            id="intake-form-new"
            label="Submission description"
            placeholder="Describe the work and why it matters…"
            html={watch("html")}
            editable={!isSubmitting}
            onChange={(html) => setValue("html", html, { shouldDirty: true })}
          />
        )}
        {errors.root && (
          <p role="alert" className="text-14 text-danger-primary">
            {errors.root.message}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" loading={isSubmitting} disabled={!snapshot && !config}>
            {snapshot ? "Save submission" : "Submit for review"}
          </Button>
          <Button type="button" variant="secondary" onClick={cancel}>
            Cancel
          </Button>
        </div>
      </fieldset>
    </form>
  );
  if (snapshot) return form;
  return (
    <>
      <Button
        variant="tertiary"
        size="sm"
        aria-label="Submit work"
        className="shrink-0"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" />
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) cancel();
        }}
      >
        <Dialog.Panel width={EDialogWidth.XXXL} className="p-6">
          <Dialog.Title className="mb-4 text-20">Submit work for review</Dialog.Title>
          <Dialog.Description className="sr-only">Submit work to this project’s intake for review.</Dialog.Description>
          {form}
        </Dialog.Panel>
      </Dialog>
    </>
  );
}
