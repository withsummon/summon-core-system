/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
// types
import { useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// ui
import { AlertModalCore } from "@plane/ui";
import { mutationMessage } from "@/components/convex-core/commercial/forms";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  tokenId: FunctionArgs<typeof api.identity.apiTokens.revoke>["keyId"];
};

export function DeleteApiTokenModal(props: Props) {
  const { isOpen, onClose, tokenId } = props;
  const revoke = useMutation(api.identity.apiTokens.revoke);
  // states
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);
  // router params
  const { t } = useTranslation();

  const handleClose = () => {
    if (!deleteLoading) onClose();
  };

  const handleDeletion = async () => {
    if (deleteLoading) return;
    setDeleteLoading(true);
    try {
      await revoke({ keyId: tokenId });
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("workspace_settings.settings.api_tokens.delete.success.title"),
        message: t("workspace_settings.settings.api_tokens.delete.success.message"),
      });
      onClose();
    } catch (failure) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("workspace_settings.settings.api_tokens.delete.error.title"),
        message: mutationMessage(failure),
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <AlertModalCore
      handleClose={handleClose}
      handleSubmit={handleDeletion}
      isSubmitting={deleteLoading}
      isOpen={isOpen}
      title={t("workspace_settings.settings.api_tokens.delete.title")}
      content={<>{t("workspace_settings.settings.api_tokens.delete.description")} </>}
    />
  );
}
