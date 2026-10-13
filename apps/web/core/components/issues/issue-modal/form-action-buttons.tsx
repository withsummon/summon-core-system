/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { ETabIndices } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { ToggleSwitch } from "@plane/ui";
import { getTabIndex } from "@plane/utils";
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";

type Props = {
  isEditing: boolean;
  isDraft: boolean;
  moveToIssue: boolean;
  isCreateMoreToggleEnabled: boolean;
  onCreateMoreToggleChange: (value: boolean) => void;
  onDiscard: () => void;
  submitBtnRef: React.MutableRefObject<HTMLButtonElement | null>;
  isSubmitting: boolean;
  isDisabled: boolean;
  primaryButtonText: { default: string; loading: string };
  isMoving: boolean;
  onMoveToProjects: () => void;
};

export const IssueFormActionButtons = observer(function IssueFormActionButtons(props: Props) {
  const {
    isEditing,
    isDraft,
    moveToIssue,
    isCreateMoreToggleEnabled,
    onCreateMoreToggleChange,
    onDiscard,
    submitBtnRef,
    isSubmitting,
    isDisabled,
    primaryButtonText,
    isMoving,
    onMoveToProjects,
  } = props;
  const { t } = useTranslation();
  const { isMobile } = usePlatformOS();
  const { getIndex } = getTabIndex(ETabIndices.ISSUE_FORM, isMobile);

  return (
    <div className="flex items-center justify-end gap-4 border-t-[0.5px] border-subtle pt-6 pb-3">
      {!isEditing && (
        <label className="inline-flex cursor-pointer items-center gap-1.5">
          <ToggleSwitch
            value={isCreateMoreToggleEnabled}
            onChange={onCreateMoreToggleChange}
            label={t("create_more")}
            size="sm"
          />
          <span className="text-caption-sm-regular">{t("create_more")}</span>
        </label>
      )}
      <div className="flex items-center gap-2">
        <div tabIndex={getIndex("discard_button")}>
          <Button variant="secondary" size="lg" onClick={onDiscard}>
            {t("discard")}
          </Button>
        </div>
        <div tabIndex={isDraft ? getIndex("submit_button") : getIndex("draft_button")}>
          <Button
            variant={moveToIssue ? "secondary" : "primary"}
            size="lg"
            type="submit"
            ref={submitBtnRef}
            loading={isSubmitting}
            disabled={isDisabled}
          >
            {isSubmitting ? primaryButtonText.loading : primaryButtonText.default}
          </Button>
        </div>

        {moveToIssue && (
          <Button
            variant="primary"
            type="button"
            loading={isMoving}
            onClick={onMoveToProjects}
            disabled={isMoving}
            size="lg"
          >
            {t("add_to_project")}
          </Button>
        )}
      </div>
    </div>
  );
});
