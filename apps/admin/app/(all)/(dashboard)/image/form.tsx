import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { ToggleSwitch } from "@plane/ui";
import { AdminFormNavigationGuard, useAdminDraftOwner } from "@/providers/user.provider";
import { ControllerInput } from "@/components/common/controller-input";
import { ConfirmDiscardModal } from "@/components/common/confirm-discard-modal";

export function InstanceImageConfigForm({
  configuration,
  initialValues,
}: {
  configuration: FunctionReturnType<typeof api.identity.instance.image.get> | undefined;
  initialValues: FunctionArgs<typeof api.identity.instance.image.save>;
}) {
  const draft = useAdminDraftOwner();
  const save = useMutation(api.identity.instance.image.save);
  const [discardOpen, setDiscardOpen] = useState(false);
  const {
    control,
    handleSubmit,
    reset,
    resetField,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FunctionArgs<typeof api.identity.instance.image.save>>({
    defaultValues: initialValues,
  });
  const busy = isSubmitting;
  const enabled = watch("apiKey") !== null;
  const stored = configuration?.credentialPresent === true;
  const canEdit = draft.canEdit && configuration !== undefined && !configuration.adoptionRequired;
  const writable = canEdit && !busy;
  useEffect(() => {
    if (!draft.canEdit) resetField("apiKey", { defaultValue: initialValues.apiKey === null ? null : "" });
  }, [draft.canEdit, resetField, initialValues.apiKey]);
  const discard = () => {
    if (!configuration || busy) return;
    reset({
      expectedRevision: configuration.revision,
      apiKey: configuration.credentialPresent ? "" : null,
    });
    draft.discard();
    setDiscardOpen(false);
  };
  const onSubmit = async (values: FunctionArgs<typeof api.identity.instance.image.save>) => {
    if (!canEdit) return;
    try {
      const revision = await save(values);
      reset({ expectedRevision: revision, apiKey: values.apiKey === null ? null : "" });
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Image settings saved",
        message: "Your Unsplash configuration has been updated.",
      });
    } catch (failure) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Image settings could not be saved",
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
      {(draft.changedSubject || isDirty) && (
        <div role="alert" className="space-y-3">
          {draft.changedSubject && <p>This draft belongs to the previous account.</p>}
          <Button disabled={busy || !configuration} onClick={() => setDiscardOpen(true)}>
            Discard draft and review current settings
          </Button>
        </div>
      )}
      {configuration?.adoptionRequired && <p role="alert">Image configuration requires explicit operator adoption.</p>}
      <fieldset hidden={draft.changedSubject} disabled={!writable} className="space-y-8">
        <div className="flex max-w-4xl items-center justify-between gap-6">
          <div>
            <h2 className="text-16 font-medium text-primary">Unsplash</h2>
            <p className="text-13 text-tertiary">
              Enable Unsplash by saving an access key. Removing the key disables the image library.
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
          {enabled && (
            <ControllerInput
              control={control}
              name="apiKey"
              type="password"
              label="Unsplash access key"
              placeholder={stored ? "Leave blank to keep the saved key" : "Unsplash access key"}
              error={Boolean(errors.apiKey)}
              required={!stored}
              description={
                <>
                  Your key is encrypted. The saved key is never displayed.{" "}
                  <a
                    href="https://unsplash.com/documentation#creating-a-developer-account"
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent-primary hover:underline"
                  >
                    Unsplash developer documentation
                  </a>
                </>
              }
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
        </div>
      </fieldset>
    </>
  );
}
