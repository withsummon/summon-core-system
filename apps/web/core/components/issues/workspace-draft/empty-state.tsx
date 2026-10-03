/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { useTranslation } from "@plane/i18n";
import { EmptyStateDetailed } from "@plane/propel/empty-state";

export function WorkspaceDraftEmptyState({
  onCreate,
  disabled,
  deleted,
}: {
  onCreate: () => void;
  disabled: boolean;
  deleted: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="relative h-full w-full overflow-y-auto">
      <EmptyStateDetailed
        title={deleted ? "No removed drafts" : t("workspace_empty_state.drafts.title")}
        description={
          deleted
            ? "Deleted drafts stay in Trash until you restore them."
            : t("workspace_empty_state.drafts.description")
        }
        assetKey="draft"
        actions={
          deleted
            ? []
            : [
                {
                  label: t("workspace_empty_state.drafts.cta_primary"),
                  onClick: onCreate,
                  disabled,
                  variant: "primary",
                },
              ]
        }
      />
    </div>
  );
}
