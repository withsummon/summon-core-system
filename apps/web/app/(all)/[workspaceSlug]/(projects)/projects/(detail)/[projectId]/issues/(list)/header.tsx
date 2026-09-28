/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { Dialog } from "@plane/propel/dialog";
import { WorkItemsIcon } from "@plane/propel/icons";
import { Input } from "@plane/propel/input";
import { AlertModalCore, Breadcrumbs, EModalPosition, EModalWidth, Header, ModalCore, ToggleSwitch } from "@plane/ui";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { TaskProperties } from "@/components/convex-core/tasks/task-properties";
import { TaskRichEditor } from "@/components/convex-core/tasks/rich-editor";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";

type Address = FunctionReturnType<typeof api.navigation.address.resolveProjectId>;

export function ProjectIssuesHeader({ address, onCreate }: { address: Address; onCreate?: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <Header>
      <Header.LeftItem>
        <Breadcrumbs onBack={() => navigate(-1)} className="flex-grow-0">
          <Breadcrumbs.Item component={<BreadcrumbLink label={address.project.name} />} />
          <Breadcrumbs.Item
            component={
              <BreadcrumbLink
                label="Work Items"
                href={`/${address.workspace.slug}/projects/${address.project._id}/issues/`}
                icon={<WorkItemsIcon className="size-4 text-tertiary" />}
                isLast
              />
            }
            isLast
          />
        </Breadcrumbs>
      </Header.LeftItem>
      <Header.RightItem>
        {onCreate && (
          <Button size="lg" onClick={onCreate}>
            {t("issue.add.label")}
          </Button>
        )}
      </Header.RightItem>
    </Header>
  );
}

export function CreateProjectIssue({
  address,
  states,
  onClose,
}: {
  address: Address;
  states: FunctionReturnType<typeof api.tasks.states.list>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const create = useMutation(api.tasks.index.create);
  const defaultState = states.find((state) => state.isDefault);
  const {
    register,
    watch,
    setValue,
    handleSubmit,
    reset,
    clearErrors,
    setError,
    formState: { isDirty, isSubmitting, errors },
  } = useForm<Required<Pick<FunctionArgs<typeof api.tasks.index.create>, "title" | "html" | "status" | "properties">>>({
    defaultValues: {
      title: "",
      html: "<p></p>",
      status: defaultState?.status ?? "todo",
      properties: {
        stateId: defaultState?._id ?? null,
        priority: "none",
        estimatePointId: null,
        assigneeIds: [],
        labelIds: [],
        startDate: null,
        targetDate: null,
      },
    },
  });
  const [createMore, setCreateMore] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const continuation = useRef<(() => void) | null>(null);
  const leave = useCallback(() => {
    continuation.current = null;
    onClose();
  }, [onClose]);
  const release = useReloadConfirmations(isDirty || isSubmitting, "This work item has unsaved changes.", leave);
  useEffect(
    () => () => {
      continuation.current = null;
    },
    []
  );
  const dismiss = () => {
    if (isSubmitting) return;
    if (isDirty) setDiscarding(true);
    else onClose();
  };
  return (
    <ModalCore
      isOpen
      handleClose={dismiss}
      position={EModalPosition.TOP}
      width={EModalWidth.XXXXL}
      className="rounded-lg !bg-transparent shadow-none"
    >
      <form
        className="flex w-full flex-col rounded-lg bg-surface-1"
        aria-busy={isSubmitting}
        onSubmit={handleSubmit(async (values) => {
          continuation.current = () => {
            if (createMore) reset();
            else onClose();
          };
          clearErrors("root");
          let taskId: FunctionReturnType<typeof api.tasks.index.create>;
          try {
            taskId = await create({ projectId: address.project._id, ...values });
          } catch (failure) {
            if (continuation.current !== null) setError("root", { type: "server", message: mutationMessage(failure) });
            continuation.current = null;
            return;
          }
          release((allow) => {
            const complete = continuation.current;
            continuation.current = null;
            complete?.();
            if (allow && complete && !createMore)
              navigate(`/${address.workspace.slug}/projects/${address.project._id}/issues/${taskId}/`);
          });
        })}
      >
        <div className="p-5">
          <Dialog.Title className="pb-2 text-h4-medium text-secondary">{t("create_new_issue")}</Dialog.Title>
          <p className="pt-2 pb-4 text-body-sm-medium text-secondary">{address.project.name}</p>
          <label className="sr-only" htmlFor="new-work-item-title">
            {t("title")}
          </label>
          <Input
            id="new-work-item-title"
            {...register("title")}
            required
            maxLength={255}
            placeholder={t("title")}
            disabled={isSubmitting}
          />
        </div>
        <div className="px-5 pb-4">
          <TaskRichEditor
            id={`create-work-item-${address.project._id}`}
            label="Work item description"
            placeholder={t("description")}
            html="<p></p>"
            value={watch("html")}
            editable={!isSubmitting}
            onChange={(html) => setValue("html", html, { shouldDirty: true })}
          />
        </div>
        <fieldset disabled={isSubmitting} className="border-t border-subtle px-5 py-3">
          <TaskProperties
            projectId={address.project._id}
            draft={{ ...watch("properties"), status: watch("status") }}
            onChange={({ status, ...properties }) => {
              setValue("status", status, { shouldDirty: true });
              setValue("properties", properties, { shouldDirty: true });
            }}
          />
        </fieldset>
        {errors.root && (
          <p role="alert" className="px-5 text-14 text-danger-primary">
            {errors.root.message}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-4 border-t border-subtle px-4 py-3">
          <label className="inline-flex items-center gap-1.5 text-caption-sm-regular">
            <ToggleSwitch
              value={createMore}
              onChange={setCreateMore}
              label={t("create_more")}
              size="sm"
              disabled={isSubmitting}
            />
            {t("create_more")}
          </label>
          <Button variant="secondary" size="lg" type="button" disabled={isSubmitting} onClick={dismiss}>
            {t("discard")}
          </Button>
          <Button size="lg" type="submit" loading={isSubmitting} disabled={isSubmitting}>
            {isSubmitting ? t("saving") : t("save")}
          </Button>
        </div>
      </form>
      {discarding && (
        <AlertModalCore
          isSubmitting={false}
          isOpen
          handleClose={() => setDiscarding(false)}
          handleSubmit={leave}
          variant="primary"
          title="Discard this work item?"
          content="Your unsaved work item changes will be lost."
          primaryButtonText={{ default: t("discard"), loading: t("discard") }}
          secondaryButtonText={t("cancel")}
        />
      )}
    </ModalCore>
  );
}
