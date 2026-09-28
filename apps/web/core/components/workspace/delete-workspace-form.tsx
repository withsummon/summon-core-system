/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useForm } from "react-hook-form";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { Dialog } from "@plane/propel/dialog";
import { Input } from "@plane/ui";

export function DeleteWorkspaceForm({
  name,
  pending,
  onDelete,
  onClose,
}: {
  name: string;
  pending: boolean;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { register, watch, handleSubmit } = useForm({ defaultValues: { workspaceName: "", confirmDelete: "" } });
  const canDelete = !pending && watch("workspaceName") === name && watch("confirmDelete") === "delete my workspace";
  return (
    <form
      onSubmit={handleSubmit(async () => {
        if (canDelete) await onDelete();
      })}
      className="flex flex-col gap-6 p-6"
    >
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-danger-subtle text-danger-primary sm:size-10">
          <AlertTriangle className="size-5 text-danger-primary" aria-hidden="true" />
        </span>
        <div>
          <div className="text-center sm:text-left">
            <Dialog.Title className="text-h5-medium">
              {t("workspace_settings.settings.general.delete_modal.title")}
            </Dialog.Title>
            <p className="mt-1 text-body-xs-regular text-secondary">
              You are about to delete the workspace <span className="text-body-xs-semibold break-words">{name}</span>.
              It will be removed from active workspaces and access will be blocked for all members. Its data is retained
              for administrator recovery.
            </p>
          </div>
          <div className="mt-4 text-secondary">
            <label htmlFor="workspaceName" className="text-body-xs-regular break-words">
              Type in this workspace&apos;s name to continue.
            </label>
            <Input
              id="workspaceName"
              type="text"
              {...register("workspaceName")}
              placeholder={name}
              className="mt-2 w-full"
              autoComplete="off"
              disabled={pending}
            />
          </div>
          <div className="mt-4 text-secondary">
            <label htmlFor="confirmDelete" className="text-body-xs-regular">
              For final confirmation, type{" "}
              <span className="text-body-xs-medium text-primary">delete my workspace </span> below.
            </label>
            <Input
              id="confirmDelete"
              type="text"
              {...register("confirmDelete")}
              className="mt-2 w-full"
              autoComplete="off"
              disabled={pending}
            />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="lg" onClick={onClose} disabled={pending}>
          {t("cancel")}
        </Button>
        <Button variant="error-fill" size="lg" type="submit" disabled={!canDelete} loading={pending}>
          {pending ? t("deleting") : t("confirm")}
        </Button>
      </div>
    </form>
  );
}
