/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { useForm, Controller } from "react-hook-form";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { WebhookIndividualEventOptions, WebhookInput, WebhookOptions, WebhookSecretKey, WebhookToggle } from "./index";
import type { NativeWorkspace } from "@/components/workspace/native-shell/session";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";

type Props = {
  workspace: NativeWorkspace;
  options: FunctionReturnType<typeof api.webhooks.index.options>;
  data?: FunctionReturnType<typeof api.webhooks.index.get>;
  onUpdated?: (updated: FunctionReturnType<typeof api.webhooks.index.update>) => void;
  onCreated?: (created: FunctionReturnType<typeof api.webhooks.actions.create>) => void;
  handleClose?: () => void;
  onPendingChange?: (pending: boolean) => void;
};

export function WebhookForm({ workspace, options, data, onUpdated, onCreated, handleClose, onPendingChange }: Props) {
  const { t } = useTranslation();
  const create = useAction(api.webhooks.actions.create);
  const update = useMutation(api.webhooks.index.update);
  const reviewed = data;
  const [allEvents, setAllEvents] = useState(!data || data.events.length === options.events.length);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManage = workspace.membershipRole === "admin";
  const {
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { isSubmitting, isDirty },
  } = useForm<FunctionArgs<typeof api.webhooks.index.update>["input"]>({
    defaultValues: reviewed
      ? { url: reviewed.url, events: reviewed.events, isActive: reviewed.isActive }
      : options.defaults,
  });
  const pending = isSubmitting || isRegenerating;
  const release = useReloadConfirmations(isDirty || pending, "Webhook changes may not be saved.", undefined, pending);
  const cancel = () => {
    if (!pending) {
      release();
      handleClose?.();
    }
  };
  return (
    <form
      onSubmit={handleSubmit(async (input) => {
        onPendingChange?.(true);
        setError(null);
        try {
          if (reviewed) {
            const updated = await update({
              workspaceId: workspace._id,
              webhookId: reviewed._id,
              expectedRevision: reviewed.revision,
              input,
            });
            onUpdated?.(updated);
            reset(input);
            release();
            setToast({ type: TOAST_TYPE.SUCCESS, title: "Success!", message: "Webhook updated successfully." });
          } else {
            const created = await create({ workspaceId: workspace._id, input });
            reset(input);
            release();
            onCreated?.(created);
            setToast({
              type: TOAST_TYPE.SUCCESS,
              title: t("workspace_settings.settings.webhooks.toasts.created.title"),
              message: t("workspace_settings.settings.webhooks.toasts.created.message"),
            });
          }
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          onPendingChange?.(false);
        }
      })}
    >
      <fieldset disabled={pending || !canManage} className="space-y-5">
        <div className="text-18 font-medium text-secondary">
          {t(
            reviewed
              ? "workspace_settings.settings.webhooks.modal.details"
              : "workspace_settings.settings.webhooks.modal.title"
          )}
        </div>
        <div className="space-y-3">
          <Controller
            control={control}
            name="url"
            render={({ field }) => (
              <WebhookInput
                value={field.value}
                onChange={field.onChange}
                hasError={error !== null}
                maxLength={options.urlMaxLength}
              />
            )}
          />
          {reviewed && <WebhookToggle control={control} />}
          <WebhookOptions
            value={allEvents ? "all" : "individual"}
            onChange={(value) => {
              setAllEvents(value === "all");
              if (value === "all") setValue("events", options.events, { shouldDirty: true });
            }}
          />
        </div>
        {!allEvents && <WebhookIndividualEventOptions control={control} events={options.events} />}
      </fieldset>
      {error && (
        <p role="alert" className="mt-3 text-13 text-danger-primary">
          {error}
        </p>
      )}
      {reviewed ? (
        <div className="space-y-5 pt-5">
          <WebhookSecretKey
            workspace={workspace}
            data={reviewed}
            disabled={pending || !canManage}
            onPendingChange={setIsRegenerating}
            onRegenerated={(updated) => onUpdated?.(updated)}
          />
          <Button size="lg" type="submit" loading={isSubmitting} disabled={!canManage || isRegenerating}>
            {isSubmitting ? t("updating") : t("update")}
          </Button>
        </div>
      ) : (
        <div className="mt-5 flex items-center justify-end gap-2 border-t-[0.5px] border-subtle px-5 py-4">
          <Button variant="secondary" size="lg" type="button" onClick={cancel} disabled={pending}>
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={isSubmitting}
            disabled={!canManage || isRegenerating}
          >
            {t("common.create")}
          </Button>
        </div>
      )}
    </form>
  );
}
