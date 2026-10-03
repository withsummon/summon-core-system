/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { CircleCheck } from "lucide-react";
import { ORGANIZATION_SIZE } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { Spinner } from "@plane/ui";
import { cn, validateWorkspaceName, validateSlug } from "@plane/utils";
import { CommonOnboardingHeader } from "@/components/onboarding/steps/common";
import { mutationMessage } from "@/components/convex-core/commercial/forms";

export function NativeWorkspaceCreate({
  onComplete,
  profileRevision,
  handleCurrentViewChange,
  hasInvitations,
  onPendingChange,
}: {
  profileRevision: number;
  onComplete: (workspaceId: Id<"workspaces">, skipInvites: boolean) => void;
  handleCurrentViewChange: () => void;
  hasInvitations: boolean;
  onPendingChange?: (pending: boolean) => void;
}) {
  const { t } = useTranslation();
  const [openingRevision] = useState(profileRevision);
  const [error, setError] = useState("");
  const create = useMutation(api.workspaces.index.create);
  const policy = useQuery(api.identity.instance.configuration.availability);
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
    onPendingChange?.(true);
    try {
      const id = await create({ ...fields, onboardingRevision: openingRevision });
      onComplete(id, fields.organizationSize === "Just myself");
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      onPendingChange?.(false);
    }
  };
  if (!policy) return <p role="status">Loading workspace options…</p>;
  const isWorkspaceCreationDisabled = policy.isWorkspaceCreationDisabled;
  const isButtonDisabled = !isValid || isSubmitting;

  if (isWorkspaceCreationDisabled) {
    return (
      <div className="flex flex-col gap-10">
        <span className="text-center text-14 text-tertiary">
          You don&apos;t seem to have any invites to a workspace and your instance admin has restricted creation of new
          workspaces. Please ask a workspace owner or admin to invite you to a workspace first and come back to this
          screen to join.
        </span>
      </div>
    );
  }
  return (
    <form
      className="flex flex-col gap-10"
      onSubmit={(e) => {
        void handleSubmit(handleCreateWorkspace)(e);
      }}
    >
      <CommonOnboardingHeader title="Create your workspace" description="All your work — unified." />
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <label
            className="text-13 font-medium text-tertiary after:ml-0.5 after:text-danger-primary after:content-['*']"
            htmlFor="name"
          >
            {t("workspace_creation.form.name.label")}
          </label>
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
              <div className="relative flex items-center rounded-md">
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={value}
                  onChange={(event) => {
                    onChange(event.target.value);
                    setValue("slug", event.target.value.toLocaleLowerCase().trim().replace(/ /g, "-"), {
                      shouldValidate: true,
                    });
                  }}
                  placeholder="Enter workspace name"
                  ref={ref}
                  className={cn(
                    "w-full rounded-md border border-strong bg-surface-1 px-3 py-2 text-secondary transition-all duration-200 placeholder:text-placeholder focus:border-transparent focus:ring-2 focus:ring-accent-strong focus:outline-none",
                    {
                      "border-strong": !errors.name,
                      "border-danger-strong": errors.name,
                    }
                  )}
                  // oxlint-disable-next-line jsx-a11y/no-autofocus -- Preserve the existing workspace-step initial focus.
                  autoFocus
                />
              </div>
            )}
          />
          {errors.name && <span className="text-13 text-danger-primary">{errors.name.message}</span>}
        </div>
        <div className="flex flex-col gap-2">
          <label
            className="text-13 font-medium text-tertiary after:ml-0.5 after:text-danger-primary after:content-['*']"
            htmlFor="slug"
          >
            {t("workspace_creation.form.url.label")}
          </label>
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
            render={({ field: { value, ref, onChange } }) => (
              <div
                className={cn(
                  "flex w-full items-center rounded-md border border-strong bg-surface-1 px-3 py-2 text-secondary transition-all duration-200 focus:border-transparent focus:ring-2 focus:ring-accent-strong focus:outline-none",
                  {
                    "border-strong": !errors.slug,
                    "border-danger-strong": errors.slug,
                  }
                )}
              >
                <span className={cn("rounded-md pr-0 whitespace-nowrap text-secondary")}>{window.location.host}/</span>
                <input
                  id="slug"
                  name="slug"
                  type="text"
                  value={value.toLocaleLowerCase().trim().replace(/ /g, "-")}
                  onChange={(e) => onChange(e.target.value.toLowerCase().trim().replace(/ /g, "-"))}
                  ref={ref}
                  placeholder={t("workspace_creation.form.url.placeholder")}
                  className={cn(
                    "ring-none w-full rounded-md border-none bg-surface-1 px-3 py-0 pl-0 text-secondary outline-none placeholder:text-placeholder"
                  )}
                />
              </div>
            )}
          />
          <p className="text-13 text-tertiary">{t("workspace_creation.form.url.edit_slug")}</p>
          {error && (
            <p role="alert" className="text-13 text-danger-primary">
              {error}
            </p>
          )}
          {errors.slug && <span className="text-13 text-danger-primary">{errors.slug.message}</span>}
        </div>
        <div className="flex flex-col gap-2">
          <label
            className="text-13 font-medium text-tertiary after:ml-0.5 after:text-danger-primary after:content-['*']"
            htmlFor="organizationSize"
          >
            {t("workspace_creation.form.organization_size.label")}
          </label>
          <div className="w-full">
            <Controller
              name="organizationSize"
              control={control}
              rules={{ required: t("common.errors.required") }}
              render={({ field: { value, onChange } }) => (
                <div className="flex flex-wrap gap-3">
                  {ORGANIZATION_SIZE.map((size) => {
                    const isSelected = value === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => onChange(size)}
                        className={`flex items-center justify-between gap-1 rounded-lg border px-3 py-2 text-13 transition-all duration-200 ${
                          isSelected
                            ? "border-subtle bg-layer-1 text-secondary"
                            : "border-subtle text-tertiary hover:border-strong"
                        }`}
                      >
                        <CircleCheck className={cn("size-4 text-placeholder", isSelected && "text-secondary")} />

                        <span className="font-medium">{size}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            />
            {errors.organizationSize && (
              <span className="text-13 text-danger-primary">{errors.organizationSize.message}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <Button variant="primary" type="submit" size="xl" className="w-full" disabled={isButtonDisabled}>
          {isSubmitting ? <Spinner height="20px" width="20px" /> : t("workspace_creation.button.default")}
        </Button>
        {hasInvitations && (
          <Button
            variant="ghost"
            type="button"
            size="xl"
            className="w-full"
            disabled={isSubmitting}
            onClick={handleCurrentViewChange}
          >
            Join existing workspace
          </Button>
        )}
      </div>
    </form>
  );
}
