/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useFormContext } from "react-hook-form";
// plane imports
import { ETabIndices } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import type { IProject } from "@plane/types";
// ui
// helpers
import { getTabIndex } from "@plane/utils";

type Props = {
  handleClose: () => void;
  isMobile?: boolean;
};

function ProjectCreateButtons(props: Props) {
  const { handleClose, isMobile = false } = props;
  const {
    formState: { isSubmitting },
  } = useFormContext<IProject>();

  const { getIndex } = getTabIndex(ETabIndices.PROJECT_CREATE, isMobile);

  return (
    <ProjectCreateButtonsView
      handleClose={handleClose}
      isSubmitting={isSubmitting}
      cancelTabIndex={getIndex("cancel")}
      submitTabIndex={getIndex("submit")}
    />
  );
}

export default ProjectCreateButtons;

export function ProjectCreateButtonsView({
  handleClose,
  isSubmitting,
  disabled = false,
  cancelTabIndex,
  submitTabIndex,
}: {
  handleClose: () => void;
  isSubmitting: boolean;
  disabled?: boolean;
  cancelTabIndex?: number;
  submitTabIndex?: number;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-end gap-2 border-t border-subtle py-4">
      <Button variant="secondary" size="lg" disabled={isSubmitting} onClick={handleClose} tabIndex={cancelTabIndex}>
        {t("common.cancel")}
      </Button>
      <Button
        variant="primary"
        size="lg"
        type="submit"
        loading={isSubmitting}
        disabled={disabled}
        tabIndex={submitTabIndex}
      >
        {isSubmitting ? t("creating") : t("create_project")}
      </Button>
    </div>
  );
}
