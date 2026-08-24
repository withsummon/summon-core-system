/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IFormattedInstanceConfiguration, TInstanceAIConfigurationKeys, TInstanceLLMProvider } from "@plane/types";
import { CustomSelect, Input } from "@plane/ui";
import { ControllerInput } from "@/components/common/controller-input";
import { useInstance } from "@/hooks/store";

type IInstanceAIForm = {
  config: IFormattedInstanceConfiguration;
};

type AIFormValues = Record<TInstanceAIConfigurationKeys, string>;

const PROVIDERS: Record<TInstanceLLMProvider, string> = {
  openai: "OpenAI",
  openai_compatible: "OpenAI-compatible",
  anthropic: "Anthropic",
  codex: "Codex (ChatGPT account)",
  gemini: "Gemini",
};

const CODEX_MODELS = [
  { value: "default", label: "Default akun Codex" },
  { value: "gpt-5.6-sol", label: "GPT-5.6 Sol" },
  { value: "gpt-5.6-terra", label: "GPT-5.6 Terra" },
  { value: "gpt-5.6-luna", label: "GPT-5.6 Luna" },
] as const;

const isProvider = (value: string): value is TInstanceLLMProvider => value in PROVIDERS;

export function InstanceAIForm({ config }: IInstanceAIForm) {
  const { testLLMConnection, updateInstanceConfigurations } = useInstance();
  const [isTesting, setIsTesting] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState<string>();
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AIFormValues>({
    defaultValues: {
      LLM_API_KEY: "",
      LLM_PROVIDER: config.LLM_PROVIDER || "openai",
      LLM_MODEL: config.LLM_MODEL || "",
      LLM_BASE_URL: config.LLM_BASE_URL || "",
      LLM_REQUEST_TIMEOUT_SECONDS: config.LLM_REQUEST_TIMEOUT_SECONDS || "60",
    },
  });
  const providerValue = watch("LLM_PROVIDER");
  const provider = isProvider(providerValue) ? providerValue : "openai";

  const onSubmit = async (formData: AIFormValues) => {
    const payload: Partial<AIFormValues> = {
      ...formData,
      LLM_BASE_URL: provider === "openai_compatible" ? formData.LLM_BASE_URL : "",
    };
    if (!formData.LLM_API_KEY.trim()) delete payload.LLM_API_KEY;

    try {
      await updateInstanceConfigurations(payload);
      setValue("LLM_API_KEY", "");
      setConnectionMessage(undefined);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Success",
        message: "AI settings updated successfully.",
      });
    } catch (_error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Could not save AI settings",
        message: "Check the provider fields and try again.",
      });
    }
  };

  const handleConnectionTest = async () => {
    setIsTesting(true);
    try {
      const result = await testLLMConnection();
      if (result.status === "error") {
        setConnectionMessage(`Connection failed: ${result.code}`);
        setToast({ type: TOAST_TYPE.ERROR, title: "Connection failed", message: result.code });
        return;
      }
      const message = `Connected to ${result.provider} (${result.model}).`;
      setConnectionMessage(message);
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Connection successful", message });
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
          ? error.code
          : "llm_provider_unavailable";
      setConnectionMessage(`Connection failed: ${code}`);
      setToast({ type: TOAST_TYPE.ERROR, title: "Connection failed", message: code });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-8">
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
              name="LLM_PROVIDER"
              rules={{ required: "Provider is required." }}
              render={({ field: { value, onChange } }) => (
                <CustomSelect
                  value={value}
                  label={PROVIDERS[isProvider(value) ? value : "openai"]}
                  onChange={onChange}
                  buttonClassName="rounded-md border-subtle"
                  input
                >
                  {Object.entries(PROVIDERS).map(([key, label]) => (
                    <CustomSelect.Option key={key} value={key} className="w-full">
                      {label}
                    </CustomSelect.Option>
                  ))}
                </CustomSelect>
              )}
            />
            {errors.LLM_PROVIDER ? (
              <span className="text-11 text-danger-primary">{errors.LLM_PROVIDER.message}</span>
            ) : null}
          </div>

          {provider === "codex" ? (
            <div className="flex flex-col gap-1">
              <h4 className="text-13 text-tertiary">Model</h4>
              <Controller
                control={control}
                name="LLM_MODEL"
                rules={{ required: "Model is required." }}
                render={({ field: { value, onChange } }) => (
                  <CustomSelect
                    value={value}
                    label={CODEX_MODELS.find((model) => model.value === value)?.label || value}
                    onChange={onChange}
                    buttonClassName="rounded-md border-subtle"
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
              {errors.LLM_MODEL ? (
                <span className="text-11 text-danger-primary">{errors.LLM_MODEL.message}</span>
              ) : null}
            </div>
          ) : (
            <ControllerInput
              control={control}
              type="text"
              name="LLM_MODEL"
              label="Model"
              description="Enter the model identifier supplied by your provider."
              placeholder="Provider model identifier"
              error={Boolean(errors.LLM_MODEL)}
              required
            />
          )}

          {provider === "openai_compatible" ? (
            <ControllerInput
              control={control}
              type="text"
              name="LLM_BASE_URL"
              label="Base URL"
              description="Optional http or https endpoint without embedded credentials."
              placeholder="https://provider.example/v1"
              error={Boolean(errors.LLM_BASE_URL)}
              required={false}
            />
          ) : null}

          <div className="flex flex-col gap-1">
            <h4 className="text-13 text-tertiary">Request timeout (seconds)</h4>
            <Controller
              control={control}
              name="LLM_REQUEST_TIMEOUT_SECONDS"
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
                  type="number"
                  min={5}
                  max={120}
                  hasError={Boolean(errors.LLM_REQUEST_TIMEOUT_SECONDS)}
                />
              )}
            />
            {errors.LLM_REQUEST_TIMEOUT_SECONDS ? (
              <span className="text-11 text-danger-primary">{errors.LLM_REQUEST_TIMEOUT_SECONDS.message}</span>
            ) : null}
          </div>

          {provider !== "codex" ? (
            <ControllerInput
              control={control}
              type="password"
              name="LLM_API_KEY"
              label="API key"
              description="Leave blank to keep the saved encrypted key."
              placeholder="Enter a replacement key"
              error={Boolean(errors.LLM_API_KEY)}
              required={false}
            />
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" size="lg" onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
          {isSubmitting ? "Saving" : "Save changes"}
        </Button>
        <Button variant="secondary" size="lg" onClick={handleConnectionTest} loading={isTesting}>
          {isTesting ? "Testing" : "Test saved connection"}
        </Button>
        {connectionMessage ? (
          <p className="text-13 text-secondary" role="status">
            {connectionMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
