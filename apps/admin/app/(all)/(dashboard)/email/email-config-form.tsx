import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Input, ToggleSwitch } from "@plane/ui";
import { AdminFormNavigationGuard, useAdminDraftOwner } from "@/providers/user.provider";
import { ControllerInput } from "@/components/common/controller-input";
import { ConfirmDiscardModal } from "@/components/common/confirm-discard-modal";
import { SendTestEmailModal } from "./test-email-modal";

export function InstanceEmailForm({
  configuration,
  initialValues,
}: {
  configuration: FunctionReturnType<typeof api.identity.instance.email.get> | undefined;
  initialValues: FunctionArgs<typeof api.identity.instance.email.save>;
}) {
  const draft = useAdminDraftOwner();
  const save = useMutation(api.identity.instance.email.save);
  const [testOpen, setTestOpen] = useState(false);
  const [testPending, setTestPending] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const {
    control,
    handleSubmit,
    reset,
    resetField,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FunctionArgs<typeof api.identity.instance.email.save>>({ defaultValues: initialValues });
  const busy = isSubmitting || testPending;
  const enabled = watch("apiKey") !== null;
  const stored = configuration?.credentialPresent === true;
  const canEdit = draft.canEdit && configuration !== undefined && !configuration.adoptionRequired;
  const writable = canEdit && !busy;
  const canTest = canEdit && !isSubmitting && !isDirty && configuration.configured;
  useEffect(() => {
    if (!draft.canEdit) resetField("apiKey", { defaultValue: initialValues.apiKey === null ? null : "" });
  }, [draft.canEdit, resetField, initialValues.apiKey]);
  const discard = () => {
    if (!configuration || busy) return;
    reset({ expectedRevision: configuration.revision, apiKey: configuration.credentialPresent ? "" : null });
    draft.discard();
    setDiscardOpen(false);
  };
  const onSubmit = async (values: FunctionArgs<typeof api.identity.instance.email.save>) => {
    if (!canEdit || testPending) return;
    try {
      const revision = await save(values);
      reset({ expectedRevision: revision, apiKey: values.apiKey === null ? null : "" });
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Email settings saved",
        message: "Your Resend configuration has been updated.",
      });
    } catch (failure) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Email settings could not be saved",
        message: failure instanceof Error ? failure.message : "Try again.",
      });
    }
  };
  return (
    <>
      <AdminFormNavigationGuard pending={busy} dirty={isDirty} />
      <ConfirmDiscardModal
        isOpen={discardOpen}
        handleClose={() => setDiscardOpen(false)}
        pending={busy}
        dirty={isDirty}
        onDiscard={discard}
      />
      <SendTestEmailModal
        isOpen={testOpen}
        handleClose={() => setTestOpen(false)}
        expectedRevision={configuration?.revision ?? initialValues.expectedRevision}
        canEdit={canTest}
        onPendingChange={setTestPending}
      />
      {(draft.changedSubject || isDirty) && (
        <div role="alert" className="space-y-3">
          {draft.changedSubject && <p>This draft belongs to the previous account.</p>}
          <Button disabled={busy || !configuration} onClick={() => setDiscardOpen(true)}>
            Discard draft and review current settings
          </Button>
        </div>
      )}
      {configuration?.adoptionRequired && <p role="alert">Email configuration requires explicit operator adoption.</p>}
      <fieldset hidden={draft.changedSubject} disabled={!writable} className="space-y-8">
        <div className="flex max-w-4xl items-center justify-between gap-6">
          <div>
            <h2 className="text-16 font-medium text-primary">Resend</h2>
            <p className="text-13 text-tertiary">
              Enable email by saving a Resend API key. Removing the key disables email delivery.
            </p>
          </div>
          <Controller
            control={control}
            name="apiKey"
            render={({ field }) => (
              <ToggleSwitch
                value={field.value !== null}
                onChange={(value) => field.onChange(value ? "" : null)}
                size="sm"
                disabled={!writable}
              />
            )}
          />
        </div>
        <div className="grid max-w-4xl grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="email-sender" className="text-13 text-tertiary">
              Sender
            </label>
            {configuration && <Input id="email-sender" value={configuration.from} readOnly />}
            <p className="text-13 text-tertiary">The sender domain must be verified in Resend.</p>
          </div>
          {enabled && (
            <ControllerInput
              control={control}
              name="apiKey"
              type="password"
              label="Resend API key"
              placeholder={stored ? "Leave blank to keep the saved key" : "Resend API key"}
              error={Boolean(errors.apiKey)}
              required={!stored}
              description="Your key is encrypted. The saved key is never displayed."
            />
          )}
        </div>
        <div className="flex max-w-4xl flex-wrap items-center gap-4">
          <Button
            variant="primary"
            size="lg"
            loading={isSubmitting}
            disabled={!isDirty}
            onClick={() => {
              void handleSubmit(onSubmit)();
            }}
          >
            Save changes
          </Button>
          <Button variant="secondary" size="lg" disabled={!canTest} onClick={() => setTestOpen(true)}>
            Send test email
          </Button>
        </div>
      </fieldset>
    </>
  );
}
