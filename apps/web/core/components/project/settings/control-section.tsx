/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useMutation } from "convex/react";
import { useNavigate } from "react-router";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { PROJECT_TRACKER_ELEMENTS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { SettingsBoxedControlItem } from "@/components/settings/boxed-control-item";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { ArchiveRestoreDialog } from "../archive-restore-modal";
import { DeleteProjectDialog } from "../delete-project-modal";

export function GeneralProjectSettingsControlSection({
  project,
  workspaceSlug,
  disabled,
}: {
  project: FunctionReturnType<typeof api.projects.form.get>;
  workspaceSlug: string;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const archive = useMutation(api.projects.settings.setArchived);
  const remove = useMutation(api.projects.lifecycle.setDeleted);
  const [selection, setSelection] = useState<{
    operation: "archive" | "delete";
    revision: number;
    name: string;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const close = () => {
    if (!pending) {
      setSelection(null);
      setError("");
    }
  };
  const release = useReloadConfirmations(
    Boolean(selection),
    "This project action has not been completed.",
    close,
    pending
  );
  const finish = () => {
    setSelection(null);
    release((allow) => {
      if (allow) navigate(`/${workspaceSlug}/projects/`);
    });
  };
  const submit = async () => {
    if (!selection) return;
    setPending(true);
    setError("");
    try {
      const target = { projectId: project.input.projectId, expectedRevision: selection.revision };
      if (selection.operation === "archive") {
        await archive({ ...target, archived: true });
      } else await remove({ ...target, deleted: true });
    } catch (failure) {
      if (selection.operation === "delete") throw failure;
      setError(mutationMessage(failure));
      return;
    } finally {
      setPending(false);
    }
    if (selection.operation === "archive") finish();
  };
  return (
    <div className="mt-10">
      {selection?.operation === "archive" && (
        <ArchiveRestoreDialog
          isOpen
          name={selection.name}
          archive
          loading={pending}
          canConfirm={project.canManage && !disabled}
          error={error}
          description="Archiving keeps project records and hides its work items, cycles and modules until an authorized administrator restores it."
          onClose={close}
          onConfirm={() => void submit()}
        />
      )}
      {selection?.operation === "delete" && (
        <DeleteProjectDialog
          isOpen
          name={selection.name}
          recoverable
          pending={pending}
          canSubmit={project.canManage && !disabled}
          onClose={close}
          onDone={finish}
          onDelete={submit}
        />
      )}
      {project.canManage && (
        <div className="rounded-lg border border-subtle bg-layer-2">
          <SettingsBoxedControlItem
            className="rounded-b-none border-0 border-b"
            title={t("archive")}
            description="Archiving a project will unlist your project from your side navigation although you will still be able to access it from your projects page. You can restore the project or delete it whenever you want."
            control={
              <Button
                variant="secondary"
                disabled={disabled}
                onClick={() => {
                  setError("");
                  setSelection({ operation: "archive", revision: project.revision, name: project.input.name });
                }}
              >
                {t("archive")}
              </Button>
            }
          />
          <SettingsBoxedControlItem
            className="rounded-t-none border-0"
            title={t("delete")}
            description="Deleting moves this project to Trash. Its data is retained and an authorized administrator can restore it."
            control={
              <Button
                variant="error-outline"
                disabled={disabled}
                data-ph-element={PROJECT_TRACKER_ELEMENTS.DELETE_PROJECT_BUTTON}
                onClick={() => {
                  setError("");
                  setSelection({ operation: "delete", revision: project.revision, name: project.input.name });
                }}
              >
                {t("delete")}
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
}
