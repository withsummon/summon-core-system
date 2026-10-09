/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, type ComponentProps } from "react";
import { WORKSPACE_TRACKER_ELEMENTS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { SettingsBoxedControlItem } from "@/components/settings/boxed-control-item";
import { DeleteWorkspaceModal } from "./delete-workspace-modal";

export function DeleteWorkspaceSection({
  disabled,
  ...workspace
}: Omit<ComponentProps<typeof DeleteWorkspaceModal>, "onClose"> & { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  return (
    <>
      {open && <DeleteWorkspaceModal {...workspace} onClose={() => setOpen(false)} />}
      <SettingsBoxedControlItem
        title={t("workspace_settings.settings.general.delete_workspace")}
        description="Remove this workspace from active workspaces and block member access. Data is retained for administrator recovery."
        control={
          <Button
            variant="error-outline"
            disabled={disabled}
            onClick={() => setOpen(true)}
            data-ph-element={WORKSPACE_TRACKER_ELEMENTS.DELETE_WORKSPACE_BUTTON}
          >
            {t("delete")}
          </Button>
        }
      />
    </>
  );
}
