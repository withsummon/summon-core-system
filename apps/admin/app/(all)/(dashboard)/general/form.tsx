/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { AdminFormNavigationGuard, useAdminDraftOwner } from "@/providers/user.provider";
import { useMutation } from "convex/react";
import { api } from "@summon/convex/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { Controller, useForm } from "react-hook-form";
import { Telescope } from "lucide-react";
// plane imports
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Input, ToggleSwitch } from "@plane/ui";
// components
import { ControllerInput } from "@/components/common/controller-input";
// hooks

export function GeneralConfigurationForm({
  configuration,
  initialValues,
}: {
  initialValues: FunctionArgs<typeof api.identity.instance.configuration.save>;
  configuration: FunctionReturnType<typeof api.identity.instance.configuration.get> | undefined;
}) {
  const draft = useAdminDraftOwner();
  const save = useMutation(api.identity.instance.configuration.save);
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FunctionArgs<typeof api.identity.instance.configuration.save>>({
    defaultValues: initialValues,
  });
  const onSubmit = async (values: FunctionArgs<typeof api.identity.instance.configuration.save>) => {
    if (!draft.canEdit) return;
    try {
      const revision = await save(values);
      reset({ ...values, expectedRevision: revision });
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Success", message: "Settings updated successfully" });
    } catch (failure) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Settings could not be saved",
        message: failure instanceof Error ? failure.message : "Try again.",
      });
    }
  };
  return (
    <>
      <AdminFormNavigationGuard pending={isSubmitting} dirty={isDirty} />
      {(draft.changedSubject || isDirty) && (
        <div role="alert" className="space-y-3">
          {draft.changedSubject && <p>This draft belongs to the previous account.</p>}
          <Button
            disabled={isSubmitting || !configuration}
            onClick={() => {
              if (!configuration || isSubmitting) return;
              reset({
                instanceName: configuration.instanceName,
                telemetryEnabled: configuration.telemetryEnabled,
                expectedRevision: configuration.revision,
              });
              draft.discard();
            }}
          >
            Discard draft and review current settings
          </Button>
        </div>
      )}
      <fieldset hidden={draft.changedSubject} disabled={isSubmitting || !draft.canEdit} className="space-y-8">
        <div className="space-y-4">
          <div className="text-16 font-medium text-primary">Instance details</div>
          <div className="grid-col grid w-full grid-cols-1 items-center justify-between gap-8 md:grid-cols-2 lg:grid-cols-3">
            <ControllerInput
              key="instanceName"
              name="instanceName"
              control={control}
              type="text"
              label="Name of instance"
              placeholder="Instance name"
              error={Boolean(errors.instanceName)}
              required
            />

            <div className="flex flex-col gap-1">
              <h4 className="text-13 text-tertiary">Email</h4>
              <Input
                id="email"
                name="email"
                type="email"
                value={configuration?.administratorEmail ?? ""}
                placeholder="Admin email"
                className="w-full cursor-not-allowed !text-placeholder"
                autoComplete="on"
                disabled
              />
            </div>

            <div className="flex flex-col gap-1">
              <h4 className="text-13 text-tertiary">Instance ID</h4>
              <Input
                id="instance_id"
                name="instance_id"
                type="text"
                value={configuration?.instanceId ?? ""}
                className="w-full cursor-not-allowed rounded-md font-medium !text-placeholder"
                disabled
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="border-b border-subtle pb-1.5 text-16 font-medium text-primary">Telemetry</div>
          <div className="flex items-center gap-14">
            <div className="flex grow items-center gap-4">
              <div className="shrink-0">
                <div className="flex size-11 items-center justify-center rounded-lg bg-layer-1">
                  <Telescope className="size-5 text-tertiary" />
                </div>
              </div>
              <div className="grow">
                <div className="text-13 leading-5 font-medium text-primary">Let Plane collect anonymous usage data</div>
                <div className="text-11 leading-5 font-regular text-tertiary">
                  No PII is collected.This anonymized data is used to understand how you use Plane and build new
                  features in line with{" "}
                  <a
                    href="https://developers.plane.so/self-hosting/telemetry"
                    target="_blank"
                    className="text-accent-primary hover:underline"
                    rel="noreferrer"
                  >
                    our Telemetry Policy.
                  </a>
                </div>
              </div>
            </div>
            <div className={`shrink-0 ${isSubmitting && "opacity-70"}`}>
              <Controller
                control={control}
                name="telemetryEnabled"
                render={({ field: { value, onChange } }) => (
                  <ToggleSwitch value={value ?? false} onChange={onChange} size="sm" disabled={isSubmitting} />
                )}
              />
            </div>
          </div>
        </div>

        <div>
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              void handleSubmit(onSubmit)();
            }}
            loading={isSubmitting}
          >
            {isSubmitting ? "Saving" : "Save changes"}
          </Button>
        </div>
      </fieldset>
    </>
  );
}
