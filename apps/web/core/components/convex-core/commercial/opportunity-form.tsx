import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { Dialog, EDialogWidth } from "@plane/propel/dialog";
import { DatePicker } from "@plane/propel/date-picker";
import { Select } from "@plane/propel/select";
import { Input } from "@plane/ui";
import { SummonField } from "@/components/summon/forms";
import { OPPORTUNITY_STAGE_LABEL } from "@/components/summon/opportunities/opportunity-pipeline";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { ClientField } from "./client-field";
import { mutationMessage } from "./forms";

export function OpportunityForm({
  workspaceId,
  context,
  onDone,
  onCancel,
}: {
  workspaceId: Id<"workspaces">;
  context: FunctionReturnType<typeof api.commercial.opportunities.get>;
  onDone: (receipt: FunctionReturnType<typeof api.commercial.opportunities.save>) => void;
  onCancel: (allowDefaultNavigation: boolean) => void;
}) {
  const save = useMutation(api.commercial.opportunities.save);
  const [target, setTarget] = useState<FunctionArgs<typeof api.commercial.opportunities.save>["target"]>(
    context.record ? { id: context.record._id, expectedUpdatedAt: context.record.updatedAt } : null
  );
  const form = useForm({ defaultValues: context.input });
  const continuation = useRef<
    ((receipt: FunctionReturnType<typeof api.commercial.opportunities.save>, allow: boolean) => void) | null
  >(null);
  const leave = useCallback(() => {
    continuation.current = null;
  }, []);
  const release = useReloadConfirmations(
    form.formState.isDirty || form.formState.isSubmitting,
    "The opportunity has unsaved changes or is still saving.",
    leave,
    form.formState.isSubmitting
  );
  useEffect(() => leave, [leave]);
  const cancel = () => {
    if (form.formState.isSubmitting) return;
    leave();
    form.reset();
    release(onCancel);
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) cancel();
      }}
    >
      <Dialog.Panel
        width={EDialogWidth.XXL}
        className="vertical-scrollbar max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl p-5"
      >
        <Dialog.Title className="text-14 font-semibold text-primary">
          {context.record ? "Edit opportunity" : "New opportunity"}
        </Dialog.Title>
        <Dialog.Description className="mt-1 text-12 text-secondary">
          Only the title is required. You can fill in the rest later.
        </Dialog.Description>
        <form
          className="mt-5 grid gap-4"
          onSubmit={form.handleSubmit(async (data) => {
            continuation.current = (receipt, allow) => {
              if (target) setTarget({ id: receipt.id, expectedUpdatedAt: receipt.updatedAt });
              form.reset(receipt.input);
              if (target || allow) onDone(receipt);
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
          <fieldset className="grid gap-3 sm:grid-cols-2" disabled={!context.canWrite || form.formState.isSubmitting}>
            <div className="sm:col-span-2">
              <SummonField label="Title">
                <Input {...form.register("title")} required maxLength={255} className="h-10" />
              </SummonField>
            </div>
            <Controller
              name="clientId"
              control={form.control}
              render={({ field }) => (
                <ClientField
                  workspaceId={workspaceId}
                  value={field.value}
                  onChange={field.onChange}
                  currentClient={context.client}
                  disabled={form.formState.isSubmitting || !context.canWrite}
                />
              )}
            />
            <SummonField label="Stage">
              <Controller
                name="stage"
                control={form.control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      const stage = context.stages.find((item) => item === value);
                      if (stage) field.onChange(stage);
                    }}
                    className="h-10"
                    disabled={form.formState.isSubmitting || !context.canWrite}
                    options={context.stages.map((value) => ({ value, label: OPPORTUNITY_STAGE_LABEL[value] }))}
                  />
                )}
              />
            </SummonField>
            <SummonField label="Value">
              <Controller
                name="value"
                control={form.control}
                render={({ field }) => (
                  <Input
                    name={field.name}
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(event.target.value || null)}
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    className="h-10"
                  />
                )}
              />
            </SummonField>
            <SummonField label="Probability (%)">
              <Input
                {...form.register("probability", { valueAsNumber: true })}
                type="number"
                min="0"
                max="100"
                step="1"
                className="h-10"
              />
            </SummonField>
            <SummonField label="Expected close">
              <Controller
                name="expectedCloseDate"
                control={form.control}
                render={({ field }) => (
                  <DatePicker
                    name={field.name}
                    value={field.value ?? ""}
                    onValueChange={(value) => field.onChange(value || null)}
                    disabled={form.formState.isSubmitting || !context.canWrite}
                    className="h-10"
                  />
                )}
              />
            </SummonField>
            <SummonField label="Product">
              <Input {...form.register("product")} maxLength={255} className="h-10" />
            </SummonField>
            <SummonField label="Source">
              <Input {...form.register("source")} maxLength={120} placeholder="e.g. Referral" className="h-10" />
            </SummonField>
            <div className="sm:col-span-2">
              <SummonField label="Description">
                <textarea
                  {...form.register("description")}
                  maxLength={100000}
                  rows={3}
                  className="rounded-md border border-strong bg-surface-1 p-2 text-13 text-primary outline-none focus:border-accent-strong"
                />
              </SummonField>
            </div>
          </fieldset>
          {form.formState.errors.root?.message && (
            <p role="alert" className="rounded-lg bg-danger-subtle/20 px-3 py-2 text-12 text-danger-primary">
              {form.formState.errors.root.message}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="xl"
              variant="secondary"
              className="h-10"
              onClick={cancel}
              disabled={form.formState.isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="xl"
              className="h-10"
              loading={form.formState.isSubmitting}
              disabled={!context.canWrite}
            >
              {context.record ? "Save changes" : "Create opportunity"}
            </Button>
          </div>
        </form>
      </Dialog.Panel>
    </Dialog>
  );
}
