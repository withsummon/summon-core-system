/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useId, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { authClient } from "@/components/convex-core/provider";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { useTranslation } from "@plane/i18n";
// ui
import { Button } from "@plane/propel/button";
import { TrashIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Input, EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
// hooks
import { useAppRouter } from "@/hooks/use-app-router";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export function DeactivateAccountModal(props: Props) {
  const router = useAppRouter();
  const { isOpen, onClose } = props;
  // hooks
  const { t } = useTranslation();
  const capabilities = useQuery(api.identity.password.index.capabilities, isOpen ? {} : "skip");
  const deactivateAccount = useMutation(api.identity.deactivation.index.deactivate);
  const passwordId = useId();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // states
  const [isDeactivating, setIsDeactivating] = useState(false);

  const handleClose = () => {
    if (isDeactivating) return;
    setPassword("");
    setError("");
    onClose();
  };

  const handleDeleteAccount = async () => {
    if (!capabilities || isDeactivating) return;
    setIsDeactivating(true);
    setError("");
    try {
      const denial = await deactivateAccount({ password: capabilities.requiresPassword ? password : undefined });
      if (denial) {
        setError(denial.message);
        setPassword("");
        return;
      }
      await authClient.signOut();
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Account deactivated",
        message: "Account deactivated successfully.",
      });
      router.push("/");
      setPassword("");
      onClose();
    } catch (failure) {
      setError(mutationMessage(failure));
      setPassword("");
    } finally {
      setIsDeactivating(false);
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={handleClose} position={EModalPosition.CENTER} width={EModalWidth.XXL}>
      <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
        <div className="">
          <div className="flex items-start gap-x-4">
            <div className="mt-3 grid place-items-center rounded-full bg-danger-subtle p-2 sm:mt-3 sm:p-2 md:mt-0 md:p-4 lg:mt-0 lg:p-4">
              <TrashIcon
                className="h-4 w-4 text-danger-primary sm:h-4 sm:w-4 md:h-6 md:w-6 lg:h-6 lg:w-6"
                aria-hidden="true"
              />
            </div>
            <div>
              <h3 className="my-4 text-20 leading-6 font-medium text-primary">{t("deactivate_your_account")}</h3>
              <p className="mt-6 list-disc pr-4 text-14 font-regular text-secondary">
                Your sign-in credentials will be removed and your workspace memberships disabled. Existing tasks,
                documents and other workspace data will remain. This account cannot be reactivated.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-3 px-4 sm:px-6">
        {capabilities ? (
          capabilities.requiresPassword ? (
            <div className="space-y-1">
              <label htmlFor={passwordId} className="text-13 font-medium text-secondary">
                Current password
              </label>
              <Input
                id={passwordId}
                type="password"
                autoComplete="current-password"
                required
                maxLength={1024}
                value={password}
                disabled={isDeactivating}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          ) : (
            <p className="text-13 text-secondary">A recent sign-in is required to deactivate your account.</p>
          )
        ) : (
          <p role="status">Checking account security…</p>
        )}
        {error && (
          <p role="alert" className="text-13 text-danger-primary">
            {error}
          </p>
        )}
      </div>
      <div className="mb-2 flex items-center justify-end gap-2 p-4 sm:px-6">
        <Button variant="secondary" size="lg" disabled={isDeactivating} onClick={handleClose}>
          {t("cancel")}
        </Button>
        <Button
          variant="error-fill"
          size="lg"
          loading={isDeactivating}
          disabled={isDeactivating || !capabilities || (capabilities.requiresPassword && !password)}
          onClick={handleDeleteAccount}
        >
          {isDeactivating ? t("deactivating") : t("confirm")}
        </Button>
      </div>
    </ModalCore>
  );
}
