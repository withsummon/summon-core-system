/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { DeleteWorkspaceForm } from "./delete-workspace-form";

type Props = Pick<FunctionArgs<typeof api.workspaces.lifecycle.setDeleted>, "workspaceId" | "expectedRevision"> & {
  name: FunctionReturnType<typeof api.settings.index.metadata>["name"];
  onClose: () => void;
  beforeDelete: () => Promise<void>;
};

export function DeleteWorkspaceModal({ workspaceId, expectedRevision, name, onClose, beforeDelete }: Props) {
  const [pending, setPending] = useState(false);
  const remove = useMutation(api.workspaces.lifecycle.setDeleted);
  const router = useRouter();
  const { t } = useTranslation();
  const handleClose = () => {
    if (!pending) onClose();
  };
  const onDelete = async () => {
    setPending(true);
    try {
      await beforeDelete();
      await remove({ workspaceId, expectedRevision, deleted: true });
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("workspace_settings.settings.general.delete_modal.success_title"),
        message: "The workspace was removed from active workspaces. Its data is retained for administrator recovery.",
      });
      onClose();
      router.replace("/");
    } catch (failure) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("workspace_settings.settings.general.delete_modal.error_title"),
        message: mutationMessage(failure),
      });
    } finally {
      setPending(false);
    }
  };
  return (
    <ModalCore isOpen handleClose={handleClose} position={EModalPosition.CENTER} width={EModalWidth.XL}>
      <DeleteWorkspaceForm name={name} pending={pending} onDelete={onDelete} onClose={handleClose} />
    </ModalCore>
  );
}
