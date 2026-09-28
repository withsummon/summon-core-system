/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { Dialog } from "@plane/propel/dialog";
import { CopyIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Tooltip } from "@plane/propel/tooltip";
// ui
import { renderFormattedDate, renderFormattedTime, copyTextToClipboard, csvDownload } from "@plane/utils";
// helpers
// types
import { usePlatformOS } from "@/hooks/use-platform-os";
// hooks

type Props = {
  handleClose: () => void;
  tokenDetails: FunctionReturnType<typeof api.identity.apiTokens.create>;
};

export function GeneratedTokenDetails(props: Props) {
  const { handleClose, tokenDetails } = props;
  const { isMobile } = usePlatformOS();
  const { t } = useTranslation();
  const expiresAt = tokenDetails.expiresAt === null ? null : new Date(tokenDetails.expiresAt);
  const copyApiToken = async () => {
    try {
      await copyTextToClipboard(tokenDetails.key);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: `${t("success")}!`,
        message: t("workspace_settings.token_copied"),
      });
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("error"),
        message: "Could not copy the secret key. Please try again.",
      });
    }
  };

  return (
    <div className="w-full p-5">
      <div className="w-full space-y-3 text-wrap">
        <Dialog.Title className="text-16 leading-6 font-medium text-primary">
          {t("workspace_settings.key_created")}
        </Dialog.Title>
        <p className="text-13 text-placeholder">{t("workspace_settings.copy_key")}</p>
      </div>
      <button
        type="button"
        onClick={copyApiToken}
        aria-label="Copy secret key"
        className="mt-4 flex w-full items-center justify-between truncate rounded-md border-[0.5px] border-subtle px-3 py-2 text-13 font-medium outline-none"
      >
        <span className="truncate pr-2">{tokenDetails.key}</span>
        <Tooltip tooltipContent="Copy secret key" isMobile={isMobile}>
          <CopyIcon className="h-4 w-4 flex-shrink-0 text-placeholder" />
        </Tooltip>
      </button>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <p className="text-11 text-placeholder">
          {expiresAt
            ? `Expires ${renderFormattedDate(expiresAt)} at ${renderFormattedTime(expiresAt)}`
            : "Never expires"}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() =>
              csvDownload(
                {
                  Title: tokenDetails.name,
                  Description: tokenDetails.metadata.description,
                  Expiry: expiresAt === null ? "Never expires" : expiresAt.toISOString(),
                  "Secret key": tokenDetails.key,
                },
                `secret-key-${Date.now()}`
              )
            }
          >
            {t("download")}
          </Button>
          <Button variant="secondary" onClick={handleClose}>
            {t("close")}
          </Button>
        </div>
      </div>
    </div>
  );
}
