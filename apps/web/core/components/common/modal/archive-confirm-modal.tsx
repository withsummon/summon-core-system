/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// ui
import { Button } from "@plane/propel/button";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";

type Props = {
  /** Lowercase entity noun shown in the copy, e.g. "cycle" or "module". */
  entityType: string;
  entityName: string | undefined;
  isOpen: boolean;
  isArchiving: boolean;
  onClose: () => void;
  onArchive: () => void;
};

export function ArchiveConfirmModal(props: Props) {
  const { entityType, entityName, isOpen, isArchiving, onClose, onArchive } = props;

  return (
    <ModalCore isOpen={isOpen} handleClose={onClose} position={EModalPosition.CENTER} width={EModalWidth.LG}>
      <div className="px-5 py-4">
        <h3 className="text-18 font-medium 2xl:text-20">
          Archive {entityType} {entityName}
        </h3>
        <p className="mt-3 text-13 text-secondary">
          Are you sure you want to archive the {entityType}? All your archives can be restored later.
        </p>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="secondary" size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="lg" onClick={onArchive} loading={isArchiving}>
            {isArchiving ? "Archiving" : "Archive"}
          </Button>
        </div>
      </div>
    </ModalCore>
  );
}
