import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { mutationMessage } from "./forms";
import { Button } from "@plane/propel/button";
import { Dialog, EDialogWidth } from "@plane/propel/dialog";
import { X } from "lucide-react";

export function ClientForm({
  workspaceId,
  context,
  onDone,
  onCancel,
  children,
  className,
}: {
  workspaceId: Id<"workspaces">;
  context: FunctionReturnType<typeof api.commercial.clients.get>;
  onDone?: (id: Id<"clients">) => void;
  onCancel?: () => void;
  children: (form: UseFormReturn<FunctionArgs<typeof api.commercial.clients.save>["data"]>) => ReactNode;
  className: string;
}) {
  const save = useMutation(api.commercial.clients.save);
  const [target, setTarget] = useState<FunctionArgs<typeof api.commercial.clients.save>["target"]>(
    context.record ? { id: context.record._id, expectedUpdatedAt: context.record.updatedAt } : null
  );
  const form = useForm({ defaultValues: context.input });
  const continuation = useRef<
    ((receipt: FunctionReturnType<typeof api.commercial.clients.save>, allow: boolean) => void) | null
  >(null);
  const leave = useCallback(() => {
    continuation.current = null;
  }, []);
  const release = useReloadConfirmations(
    form.formState.isDirty || form.formState.isSubmitting,
    "The client has unsaved changes or is still saving.",
    leave,
    form.formState.isSubmitting
  );
  useEffect(() => leave, [leave]);
  const element = (
    <form
      className={className}
      onSubmit={form.handleSubmit(async (data) => {
        continuation.current = (receipt, allow) => {
          if (target) setTarget({ id: receipt.id, expectedUpdatedAt: receipt.updatedAt });
          form.reset(target ? receipt.input : context.input);
          if (target || allow) onDone?.(receipt.id);
        };
        try {
          const receipt = await save({ workspaceId, target, data });
          release((allow) => {
            const complete = continuation.current;
            continuation.current = null;
            complete?.(receipt, allow);
          });
        } catch (failure) {
          if (continuation.current !== null)
            form.setError("root", { type: "server", message: mutationMessage(failure) });
          continuation.current = null;
        }
      })}
    >
      <fieldset className="contents" disabled={!context.canWrite || form.formState.isSubmitting}>
        {children(form)}
        {context.record ? (
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button size="xl" type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button size="xl" type="submit" loading={form.formState.isSubmitting}>
              Save changes
            </Button>
          </div>
        ) : (
          <Button size="xl" type="submit" loading={form.formState.isSubmitting}>
            Create client
          </Button>
        )}
      </fieldset>
      {form.formState.errors.root?.message && (
        <p role="alert" className="text-xs text-danger-primary">
          {form.formState.errors.root.message}
        </p>
      )}
    </form>
  );
  if (!context.record) return element;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !form.formState.isSubmitting) onCancel?.();
      }}
    >
      <Dialog.Panel
        width={EDialogWidth.XL}
        className="vertical-scrollbar max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <Dialog.Title className="text-18 font-semibold text-primary">Edit Client</Dialog.Title>
            <Dialog.Description className="text-xs mt-1 text-secondary">
              Changes are saved to the Summon client record.
            </Dialog.Description>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={form.formState.isSubmitting}
            className="grid size-8 place-items-center rounded-lg border border-subtle text-secondary"
            aria-label="Close edit client"
          >
            <X className="size-4" />
          </button>
        </div>
        {element}
      </Dialog.Panel>
    </Dialog>
  );
}
