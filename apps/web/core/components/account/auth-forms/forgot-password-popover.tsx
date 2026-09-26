/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Popover } from "@plane/propel/popover";
// plane imports
import { useTranslation } from "@plane/i18n";
import { CloseIcon } from "@plane/propel/icons";

export function ForgotPasswordPopover() {
  const [popoverOpen, setPopoverOpen] = useState(false);

  // plane hooks
  const { t } = useTranslation();

  return (
    <div className="relative">
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <Popover.Button
          render={
            <button type="button" className="text-11 font-medium text-accent-primary outline-none">
              {t("auth.common.forgot_password")}
            </button>
          }
        />
        <Popover.Panel className="z-10" positionerClassName="z-50" placement="right-start">
          {
            <div className="z-10 ml-3 flex w-64 items-start gap-3 rounded-sm border border-strong bg-surface-1 px-2 py-1 text-left break-words">
              <span className="flex-shrink-0">🤥</span>
              <p className="text-11">{t("auth.forgot_password.errors.smtp_not_enabled")}</p>
              <button
                type="button"
                className="grid size-3 flex-shrink-0 place-items-center"
                onClick={() => setPopoverOpen(false)}
                aria-label={t("aria_labels.auth_forms.close_popover")}
              >
                <CloseIcon className="size-3 text-secondary" />
              </button>
            </div>
          }
        </Popover.Panel>
      </Popover>
    </div>
  );
}
