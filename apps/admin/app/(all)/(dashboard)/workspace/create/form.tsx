/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { AdminFormNavigationGuard, useAdminDraftOwner } from "@/providers/user.provider";
import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@summon/convex/api";
import type { FunctionArgs } from "convex/server";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
// plane imports
import { WEB_BASE_URL, ORGANIZATION_SIZE } from "@plane/constants";
import { Button, getButtonStyling } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { validateSlug, validateWorkspaceName } from "@plane/utils";
// components
import { CustomSelect, Input } from "@plane/ui";
// hooks

export function WorkspaceCreateForm() {
  // router
  const router = useRouter();
  const draft = useAdminDraftOwner();
  // states
  const [invalidSlug, setInvalidSlug] = useState(false);
  const createWorkspace = useMutation(api.identity.instance.workspaces.create);
  // form info
  const {
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isSubmitting, isValid, isDirty, isSubmitSuccessful },
  } = useForm<FunctionArgs<typeof api.identity.instance.workspaces.create>>({
    defaultValues: { name: "", slug: "", organizationSize: "" },
    mode: "onChange",
  });
  // derived values
  const [workspaceBaseURL, setWorkspaceBaseURL] = useState(() => encodeURI(WEB_BASE_URL || ""));

  useEffect(() => {
    if (!WEB_BASE_URL) {
      setWorkspaceBaseURL(encodeURI(window.location.origin + "/"));
    }
  }, []);

  useEffect(() => {
    if (isSubmitSuccessful && !isSubmitting && draft.canEdit) router.push("/workspace");
  }, [isSubmitSuccessful, isSubmitting, draft.canEdit, router]);
  const handleCreateWorkspace = async (values: FunctionArgs<typeof api.identity.instance.workspaces.create>) => {
    if (!draft.canEdit) throw new Error("Current instance administration access is required.");
    try {
      await createWorkspace(values);
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Success!", message: "Workspace created successfully." });
    } catch (failure) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Workspace could not be created",
        message: failure instanceof Error ? failure.message : "Try again.",
      });
      throw failure;
    }
  };

  return (
    <>
      <AdminFormNavigationGuard pending={isSubmitting} dirty={isDirty && !isSubmitSuccessful} />
      {draft.changedSubject && (
        <div role="alert" className="space-y-3">
          <p>This draft belongs to the previous account.</p>
          <Button
            disabled={isSubmitting}
            onClick={() => {
              reset({ name: "", slug: "", organizationSize: "" });
              draft.discard();
            }}
          >
            Discard draft and create a workspace
          </Button>
        </div>
      )}
      <fieldset hidden={draft.changedSubject} className="space-y-8" disabled={isSubmitting || !draft.canEdit}>
        <div className="grid-col grid w-full max-w-4xl grid-cols-1 items-start justify-between gap-x-10 gap-y-6 lg:grid-cols-2">
          <div className="flex flex-col gap-1">
            <h4 className="text-13 text-tertiary">Name your workspace</h4>
            <div className="flex flex-col gap-1">
              <Controller
                control={control}
                name="name"
                rules={{
                  validate: (value) => validateWorkspaceName(value, true),
                }}
                render={({ field: { value, ref, onChange } }) => (
                  <Input
                    id="workspaceName"
                    type="text"
                    value={value}
                    onChange={(e) => {
                      onChange(e.target.value);
                      setValue("name", e.target.value);
                      setValue("slug", e.target.value.toLocaleLowerCase().trim().replace(/ /g, "-"), {
                        shouldValidate: true,
                      });
                    }}
                    ref={ref}
                    hasError={Boolean(errors.name)}
                    placeholder="Something familiar and recognizable is always best."
                    className="w-full"
                  />
                )}
              />
              <span className="text-11 text-danger-primary">{errors?.name?.message}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <h4 className="text-13 text-tertiary">Set your workspace&apos;s URL</h4>
            <div className="flex w-full items-center gap-0.5 rounded-md border-[0.5px] border-subtle px-3">
              <span className="text-13 whitespace-nowrap text-secondary">{workspaceBaseURL}</span>
              <Controller
                control={control}
                name="slug"
                rules={{
                  validate: (value) => validateSlug(value),
                }}
                render={({ field: { onChange, value, ref } }) => (
                  <Input
                    id="workspaceUrl"
                    type="text"
                    value={value.toLocaleLowerCase().trim().replace(/ /g, "-")}
                    onChange={(e) => {
                      if (/^[a-zA-Z0-9_-]+$/.test(e.target.value)) setInvalidSlug(false);
                      else setInvalidSlug(true);
                      onChange(e.target.value.toLowerCase());
                    }}
                    ref={ref}
                    hasError={Boolean(errors.slug)}
                    placeholder="workspace-name"
                    className="block w-full rounded-md border-none bg-transparent !px-0 py-2 text-13"
                  />
                )}
              />
            </div>
            {invalidSlug && (
              <p className="text-13 text-danger-primary">{`URLs can contain only ( - ), ( _ ) and alphanumeric characters.`}</p>
            )}
            {errors.slug && <span className="text-11 text-danger-primary">{errors.slug.message}</span>}
          </div>
          <div className="flex flex-col gap-1">
            <h4 className="text-13 text-tertiary">How many people will use this workspace?</h4>
            <div className="w-full">
              <Controller
                name="organizationSize"
                control={control}
                rules={{ required: "This is a required field." }}
                render={({ field: { value, onChange } }) => (
                  <CustomSelect
                    value={value}
                    onChange={onChange}
                    label={
                      ORGANIZATION_SIZE.find((c) => c === value) ?? (
                        <span className="text-placeholder">Select a range</span>
                      )
                    }
                    buttonClassName="!border-[0.5px] !border-subtle !shadow-none"
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
        <div className="flex max-w-4xl items-center gap-4 py-1">
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              void handleSubmit(handleCreateWorkspace)().catch(() => {});
            }}
            disabled={!isValid}
            loading={isSubmitting}
          >
            {isSubmitting ? "Creating workspace" : "Create workspace"}
          </Button>
          <Link className={getButtonStyling("secondary", "lg")} href="/workspace">
            Go back
          </Link>
        </div>
      </fieldset>
    </>
  );
}
