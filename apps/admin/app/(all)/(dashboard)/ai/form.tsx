/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { useAction, useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { CustomSelect, Input } from "@plane/ui";
import { AdminFormNavigationGuard, useAdminDraftOwner } from "@/providers/user.provider";
import { ConfirmDiscardModal } from "@/components/common/confirm-discard-modal";
import { ControllerInput } from "@/components/common/controller-input";

const CODEX_MODELS = [
  { value: "default", label: "Default akun Codex" },
  { value: "gpt-5.6-sol", label: "GPT-5.6 Sol" },
  { value: "gpt-5.6-terra", label: "GPT-5.6 Terra" },
  { value: "gpt-5.6-luna", label: "GPT-5.6 Luna" },
] as const;

export function InstanceAIForm({
  configuration,
  initialValues,
}: {
  configuration: FunctionReturnType<typeof api.identity.instance.ai.get> | undefined;
  initialValues: FunctionArgs<typeof api.identity.instance.ai.save>;
}) {
  const draft = useAdminDraftOwner();
  const save = useMutation(api.identity.instance.ai.save);
  const test = useAction(api.identity.instance.ai.test);
  const [isTesting, setIsTesting] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState<string>();
  const {
    control,
    handleSubmit,
    getValues,
    watch,
    reset,
    resetField,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FunctionArgs<typeof api.identity.instance.ai.save>>({ defaultValues: initialValues });
  const provider = watch("provider");
  const busy = isSubmitting || isTesting;
  const canEdit = draft.canEdit && configuration !== undefined && !configuration.adoptionRequired;
  const writable = canEdit && !busy;
  useEffect(() => {
    if (!draft.canEdit) resetField("key", { defaultValue: "" });
  }, [draft.canEdit, resetField]);
  const discard = () => {
    const stored = configuration?.configuration;
    if (!stored || busy) return;
    reset({
      expectedRevision: configuration.revision,
      provider: stored.provider,
      model: stored.model,
      baseUrl: stored.baseUrl,
      timeout: stored.timeout,
      key: "",
    });
    draft.discard();
    setConnectionMessage(undefined);
    setDiscardOpen(false);
  };
  const onSubmit = async (values: FunctionArgs<typeof api.identity.instance.ai.save>) => {
    if (!canEdit || isTesting) return;
    try {
      const revision = await save({
        ...values,
        baseUrl: values.provider === "openai_compatible" ? values.baseUrl : "",
      });
      reset({
        ...values,
        expectedRevision: revision,
        key: "",
        baseUrl: values.provider === "openai_compatible" ? values.baseUrl : "",
      });
      setConnectionMessage(undefined);
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Success", message: "AI settings updated successfully." });
    } catch (failure) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Could not save AI settings",
        message: failure instanceof Error ? failure.message : "Check the provider fields and try again.",
      });
    }
  };
  const handleConnectionTest = async () => {
    if (!canEdit || busy) return;
    const expectedRevision = getValues("expectedRevision");
    setIsTesting(true);
    setConnectionMessage(undefined);
    try {
      const result = await test({ expectedRevision });
      if (result.status === "error") {
        setConnectionMessage(`Connection failed: ${result.code}`);
        setToast({ type: TOAST_TYPE.ERROR, title: "Connection failed", message: result.code });
      } else {
        const message = `Connected to ${result.provider} (${result.model}).`;
        setConnectionMessage(message);
        setToast({ type: TOAST_TYPE.SUCCESS, title: "Connection successful", message });
      }
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "Connection acceptance could not be confirmed.";
      setConnectionMessage(message);
      setToast({ type: TOAST_TYPE.ERROR, title: "Connection failed", message });
    } finally {
      setIsTesting(false);
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
          <Button disabled={busy || !configuration?.configuration} onClick={() => setDiscardOpen(true)}>
            Discard draft and review current settings
          </Button>
        </div>
      )}
      <fieldset hidden={draft.changedSubject} disabled={!writable} className="space-y-8">
        <div className="space-y-4">
          <div>
            <div className="pb-1 text-18 font-medium text-primary">LLM provider</div>
            <div className="text-13 font-regular text-tertiary">
              Configure one provider for Plane and Summon AI features across this instance.
            </div>
          </div>
          <div className="grid w-full max-w-4xl grid-cols-1 items-start gap-x-12 gap-y-8 lg:grid-cols-2">
            <div className="flex flex-col gap-1">
              <h4 className="text-13 text-tertiary">Provider</h4>
              <Controller
                control={control}
                name="provider"
                rules={{ required: "Provider is required." }}
                render={({ field: { value, onChange } }) => (
                  <CustomSelect
                    value={value}
                    label={configuration?.providers.find((entry) => entry.value === value)?.label}
                    onChange={onChange}
                    disabled={!writable}
                    buttonClassName="rounded-md border-subtle"
                    input
                  >
                    {configuration?.providers.map(({ value: key, label }) => (
                      <CustomSelect.Option key={key} value={key} className="w-full">
                        {label}
                      </CustomSelect.Option>
                    ))}
                  </CustomSelect>
                )}
              />
              {errors.provider ? <span className="text-11 text-danger-primary">{errors.provider.message}</span> : null}
            </div>

            {provider === "codex" ? (
              <div className="flex flex-col gap-1">
                <h4 className="text-13 text-tertiary">Model</h4>
                <Controller
                  control={control}
                  name="model"
                  rules={{ required: "Model is required." }}
                  render={({ field: { value, onChange } }) => (
                    <CustomSelect
                      value={value}
                      label={CODEX_MODELS.find((model) => model.value === value)?.label || value}
                      onChange={onChange}
                      buttonClassName="rounded-md border-subtle"
                      disabled={!writable}
                      input
                    >
                      {CODEX_MODELS.map((model) => (
                        <CustomSelect.Option key={model.value} value={model.value} className="w-full">
                          {model.label}
                        </CustomSelect.Option>
                      ))}
                    </CustomSelect>
                  )}
                />
                <span className="text-11 text-tertiary">Default mengikuti model aktif pada akun Codex.</span>
                {errors.model ? <span className="text-11 text-danger-primary">{errors.model.message}</span> : null}
              </div>
            ) : (
              <ControllerInput
                control={control}
                type="text"
                name="model"
                label="Model"
                description="Enter the model identifier supplied by your provider."
                placeholder="Provider model identifier"
                error={Boolean(errors.model)}
                required
              />
            )}

            {provider === "openai_compatible" ? (
              <ControllerInput
                control={control}
                type="text"
                name="baseUrl"
                label="Base URL"
                description="Provider http or https endpoint without embedded credentials."
                placeholder="https://provider.example/v1"
                error={Boolean(errors.baseUrl)}
                required={false}
              />
            ) : null}

            <div className="flex flex-col gap-1">
              <h4 className="text-13 text-tertiary">Request timeout (seconds)</h4>
              <Controller
                control={control}
                name="timeout"
                rules={{
                  required: "Request timeout is required.",
                  validate: (value) => {
                    const timeout = Number(value);
                    return (Number.isInteger(timeout) && timeout >= 5 && timeout <= 120) || "Use 5 through 120.";
                  },
                }}
                render={({ field }) => (
                  <Input
                    {...field}
                    value={field.value}
                    onChange={(event) => field.onChange(Number(event.target.value))}
                    type="number"
                    min={5}
                    max={120}
                    hasError={Boolean(errors.timeout)}
                  />
                )}
              />
              {errors.timeout ? <span className="text-11 text-danger-primary">{errors.timeout.message}</span> : null}
            </div>

            {provider !== "codex" ? (
              <ControllerInput
                control={control}
                type="password"
                name="key"
                label="API key"
                description="Leave blank to keep the saved encrypted key."
                placeholder="Enter a replacement key"
                error={Boolean(errors.key)}
                required={false}
              />
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            size="lg"
            onClick={handleSubmit(onSubmit)}
            loading={isSubmitting}
            disabled={!writable}
          >
            {isSubmitting ? "Saving" : "Save changes"}
          </Button>
          <Button variant="secondary" size="lg" onClick={handleConnectionTest} loading={isTesting} disabled={!writable}>
            {isTesting ? "Testing" : "Test saved connection"}
          </Button>
          {connectionMessage ? (
            <p className="text-13 text-secondary" role="status">
              {connectionMessage}
            </p>
          ) : null}
        </div>
      </fieldset>
    </>
  );
}
