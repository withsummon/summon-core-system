/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ORGANIZATION_SIZE } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
// ui
import { CustomSelect, Input } from "@plane/ui";
import { validateWorkspaceName, validateSlug } from "@plane/utils";
// hooks
import { useAppRouter } from "@/hooks/use-app-router";
// services

type Props = {
  onSubmit: (workspaceId: FunctionReturnType<typeof api.workspaces.index.create>, slug: string) => void;
  secondaryButton?: React.ReactNode;
  primaryButtonText?: {
    loading: string;
    default: string;
  };
};

export function CreateWorkspaceForm(props: Props) {
  const { t } = useTranslation();
  const {
    onSubmit,
    secondaryButton,
    primaryButtonText = {
      loading: "workspace_creation.button.loading",
      default: "workspace_creation.button.default",
    },
  } = props;
  // states
  const [error, setError] = useState("");
  // router
  const router = useAppRouter();
  // store hooks
  const createWorkspace = useMutation(api.workspaces.index.create);
  // form info
  const {
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting, isValid },
  } = useForm<FunctionArgs<typeof api.workspaces.index.create>>({
    defaultValues: { name: "", slug: "", organizationSize: "" },
    mode: "onChange",
  });

  const handleCreateWorkspace = async (fields: FunctionArgs<typeof api.workspaces.index.create>) => {
    setError("");
    try {
      const workspaceId = await createWorkspace(fields);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("workspace_creation.toast.success.title"),
        message: t("workspace_creation.toast.success.message"),
      });
      onSubmit(workspaceId, fields.slug);
    } catch (failure) {
      setError(mutationMessage(failure));
    }
  };

  return (
    <form
      className="space-y-6 sm:space-y-9"
      onSubmit={(e) => {
        void handleSubmit(handleCreateWorkspace)(e);
      }}
    >
      <div className="space-y-6 sm:space-y-7">
        <div className="flex flex-col gap-2 text-13">
          <label htmlFor="workspaceName">
            {t("workspace_creation.form.name.label")}
            <span className="ml-0.5 text-danger-primary">*</span>
          </label>
          <div className="flex flex-col gap-1">
            <Controller
              control={control}
              name="name"
              rules={{
                required: t("common.errors.required"),
                validate: (value) => validateWorkspaceName(value, true),
                maxLength: {
                  value: 80,
                  message: t("workspace_creation.errors.validation.name_length"),
                },
              }}
              render={({ field: { value, ref, onChange } }) => (
                <Input
                  id="workspaceName"
                  type="text"
                  value={value}
                  onChange={(e) => {
                    onChange(e.target.value);
                    setValue("slug", e.target.value.toLocaleLowerCase().trim().replace(/ /g, "-"), {
                      shouldValidate: true,
                    });
                  }}
                  ref={ref}
                  hasError={Boolean(errors.name)}
                  placeholder={t("workspace_creation.form.name.placeholder")}
                  className="w-full"
                />
              )}
            />
            <span className="text-11 text-danger-primary">{errors?.name?.message}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 text-13">
          <label htmlFor="workspaceUrl">
            {t("workspace_creation.form.url.label")}
            <span className="ml-0.5 text-danger-primary">*</span>
          </label>
          <div className="flex w-full items-center rounded-md border border-subtle bg-layer-2 px-3">
            <span className="text-12 whitespace-nowrap text-secondary">{window.location.host}/</span>
            <Controller
              control={control}
              name="slug"
              rules={{
                validate: validateSlug,
                required: t("common.errors.required"),
                maxLength: {
                  value: 48,
                  message: t("workspace_creation.errors.validation.url_length"),
                },
              }}
              render={({ field: { onChange, value, ref } }) => (
                <Input
                  id="workspaceUrl"
                  type="text"
                  value={value.toLocaleLowerCase().trim().replace(/ /g, "-")}
                  onChange={(e) => onChange(e.target.value.toLowerCase().trim().replace(/ /g, "-"))}
                  ref={ref}
                  hasError={Boolean(errors.slug)}
                  placeholder={t("workspace_creation.form.url.placeholder")}
                  className="block w-full rounded-md border-none bg-transparent !px-0 py-2 text-12"
                />
              )}
            />
          </div>
          {error && (
            <p role="alert" className="text-13 text-danger-primary">
              {error}
            </p>
          )}
          {errors.slug && <span className="text-11 text-danger-primary">{errors.slug.message}</span>}
        </div>
        <div className="flex flex-col gap-2 text-13">
          <span>
            {t("workspace_creation.form.organization_size.label")}
            <span className="ml-0.5 text-danger-primary">*</span>
          </span>
          <div className="w-full">
            <Controller
              name="organizationSize"
              control={control}
              rules={{ required: t("common.errors.required") }}
              render={({ field: { value, onChange } }) => (
                <CustomSelect
                  value={value}
                  onChange={onChange}
                  label={
                    ORGANIZATION_SIZE.find((c) => c === value) ?? (
                      <span className="text-placeholder">
                        {t("workspace_creation.form.organization_size.placeholder")}
                      </span>
                    )
                  }
                  buttonClassName="border border-subtle bg-layer-2 !shadow-none !rounded-md"
                  input
                >
                  {ORGANIZATION_SIZE.map((item) => (
                    <CustomSelect.Option key={item} value={item}>
                      {item}
                    </CustomSelect.Option>
                  ))}
                </CustomSelect>
              )}
            />
            {errors.organizationSize && (
              <span className="text-13 text-danger-primary">{errors.organizationSize.message}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {secondaryButton}
        <Button variant="primary" type="submit" size="xl" disabled={!isValid || isSubmitting} loading={isSubmitting}>
          {isSubmitting ? t(primaryButtonText.loading) : t(primaryButtonText.default)}
        </Button>
        {!secondaryButton && (
          <Button variant="secondary" type="button" size="xl" disabled={isSubmitting} onClick={() => router.back()}>
            {t("common.go_back")}
          </Button>
        )}
      </div>
    </form>
  );
}
