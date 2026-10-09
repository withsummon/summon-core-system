/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { AdminFormNavigationGuard, useAdminDraftOwner } from "@/providers/user.provider";
import { ToggleSwitch } from "@plane/ui";
import { Button, getButtonStyling } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { CodeBlock } from "@/components/common/code-block";
import { ConfirmDiscardModal } from "@/components/common/confirm-discard-modal";
import { ControllerInput, type TControllerInputFormField } from "@/components/common/controller-input";
import { PageWrapper } from "@/components/common/page-wrapper";
import { CopyField, type TCopyField } from "@/components/common/copy-field";

export function InstanceGiteaConfigForm({
  initialValues,
  configuration,
  pending,
  header,
}: {
  initialValues: FunctionArgs<typeof api.identity.instance.oauth.save>;
  configuration: FunctionReturnType<typeof api.identity.instance.oauth.get> | undefined;
  pending: boolean;
  header: (pending: boolean) => React.ReactNode;
}) {
  const [isDiscardChangesModalOpen, setIsDiscardChangesModalOpen] = useState(false);
  const draft = useAdminDraftOwner();
  const save = useMutation(api.identity.instance.oauth.save);
  const {
    handleSubmit,
    control,
    reset,
    resetField,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FunctionArgs<typeof api.identity.instance.oauth.save>>({ defaultValues: initialValues });
  const busy = isSubmitting || pending;
  const stored = configuration?.configuration;
  const adoptionRequired = configuration?.adoptionRequired;
  useEffect(() => {
    if (!draft.canEdit) resetField("configuration.clientSecret", { defaultValue: "" });
  }, [draft.canEdit, resetField]);
  const GITEA_FORM_FIELDS: TControllerInputFormField[] = [
    {
      key: "configuration.host",
      type: "text",
      label: "Gitea Host",
      description: (
        <>Use the URL of your Gitea instance. For the official Gitea instance, use &quot;https://gitea.com&quot;.</>
      ),
      placeholder: "https://gitea.com",
      error: Boolean(errors.configuration?.host),
      required: true,
    },
    {
      key: "configuration.clientId",
      type: "text",
      label: "Client ID",
      description: (
        <>
          You will get this from your{" "}
          <a
            href="https://gitea.com/user/settings/applications"
            target="_blank"
            className="text-accent-primary hover:underline"
            rel="noreferrer"
          >
            Gitea OAuth application settings.
          </a>
        </>
      ),
      placeholder: "70a44354520df8bd9bcd",
      error: Boolean(errors.configuration?.clientId),
      required: true,
    },
    {
      key: "configuration.clientSecret",
      type: "password",
      label: "Client secret",
      description: (
        <>
          Your client secret is also found in your{" "}
          <a
            href="https://gitea.com/user/settings/applications"
            target="_blank"
            className="text-accent-primary hover:underline"
            rel="noreferrer"
          >
            Gitea OAuth application settings.
          </a>
        </>
      ),
      placeholder: "9b0050f94ec1b744e32ce79ea4ffacd40d4119cb",
      error: Boolean(errors.configuration?.clientSecret),
      required: !stored?.credentialPresent,
    },
  ];

  const GITEA_SERVICE_FIELD: TCopyField[] = [
    {
      key: "Callback_URI",
      label: "Callback URI",
      url: configuration?.callbackUrl ?? "",
      description: (
        <>
          We will auto-generate this. Paste this into your <CodeBlock darkerShade>Authorized Callback URI</CodeBlock>{" "}
          field{" "}
          <a
            href={`${stored?.host ?? "https://gitea.com"}/user/settings/applications`}
            target="_blank"
            className="text-accent-primary hover:underline"
            rel="noreferrer"
            aria-label="Gitea OAuth application settings"
          >
            here.
          </a>
        </>
      ),
    },
  ];

  const onSubmit = async (values: FunctionArgs<typeof api.identity.instance.oauth.save>) => {
    if (!draft.canEdit || pending || adoptionRequired) return;
    try {
      const revision = await save({
        ...values,
        configuration: values.configuration
          ? { ...values.configuration, organization: values.configuration.organization || undefined }
          : null,
      });
      reset({
        ...values,
        expectedRevision: revision,
        configuration: values.configuration ? { ...values.configuration, clientSecret: "" } : null,
      });
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Done!",
        message: "Provider configuration saved. Test the sign-in flow before enabling it for members.",
      });
    } catch (failure) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Configuration could not be saved",
        message: failure instanceof Error ? failure.message : "Try again.",
      });
    }
  };

  const handleGoBack = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    if (isDirty || busy) {
      e.preventDefault();
      setIsDiscardChangesModalOpen(true);
    }
  };

  return (
    <PageWrapper customHeader={header(isSubmitting)}>
      <AdminFormNavigationGuard pending={busy} dirty={isDirty} />
      {adoptionRequired && <p role="alert">OAuth configuration requires explicit operator adoption.</p>}
      {(isDirty || draft.changedSubject) && (
        <Button
          disabled={busy || !configuration}
          onClick={() => {
            if (!configuration) return;
            reset({
              provider: initialValues.provider,
              expectedRevision: configuration.revision,
              configuration: {
                clientId: configuration.configuration?.clientId ?? "",
                clientSecret: "",
                sync: configuration.configuration?.sync ?? false,
                host: configuration.configuration?.host ?? undefined,
                organization: configuration.configuration?.organization ?? undefined,
              },
            });
            draft.discard();
          }}
        >
          Discard draft and review current settings
        </Button>
      )}
      <ConfirmDiscardModal
        isOpen={isDiscardChangesModalOpen}
        pending={busy}
        dirty={isDirty}
        onDiscardHref="/authentication"
        handleClose={() => setIsDiscardChangesModalOpen(false)}
      />
      <fieldset
        hidden={draft.changedSubject}
        disabled={busy || !draft.canEdit || adoptionRequired}
        className="flex flex-col gap-8"
      >
        <div className="grid w-full grid-cols-2 gap-x-12 gap-y-8">
          <div className="col-span-2 flex flex-col gap-y-4 pt-1 md:col-span-1">
            <div className="pt-2.5 text-18 font-medium">Gitea-provided details for Plane</div>
            {GITEA_FORM_FIELDS.map((field) => (
              <ControllerInput
                key={field.key}
                control={control}
                type={field.type}
                name={field.key}
                label={field.label}
                description={field.description}
                placeholder={field.placeholder}
                error={field.error}
                required={field.required}
              />
            ))}
            <div className="flex items-center justify-between gap-1">
              <h4 className="text-sm text-custom-text-300">Refresh user attributes from Gitea during sign in</h4>
              <Controller
                control={control}
                name="configuration.sync"
                render={({ field }) => (
                  <ToggleSwitch value={field.value ?? false} onChange={field.onChange} size="sm" />
                )}
              />
            </div>
            <div className="flex flex-col gap-1 pt-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={(e) => void handleSubmit(onSubmit)(e)}
                  loading={isSubmitting}
                  disabled={!isDirty}
                >
                  {isSubmitting ? "Saving" : "Save changes"}
                </Button>
                <Link href="/authentication" className={getButtonStyling("secondary", "lg")} onClick={handleGoBack}>
                  Go back
                </Link>
              </div>
            </div>
          </div>
          <div className="col-span-2 md:col-span-1">
            <div className="flex flex-col gap-y-4 rounded-lg bg-layer-1 px-6 pt-1.5 pb-4">
              <div className="pt-2 text-18 font-medium">Plane-provided details for Gitea</div>
              {GITEA_SERVICE_FIELD.map((field) => (
                <CopyField key={field.key} label={field.label} url={field.url} description={field.description} />
              ))}
            </div>
          </div>
        </div>
      </fieldset>
    </PageWrapper>
  );
}
