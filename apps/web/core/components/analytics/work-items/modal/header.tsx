/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane package imports
import { Expand, Shrink, RefreshCw } from "lucide-react";
import { CloseIcon } from "@plane/propel/icons";
import { Dialog } from "@plane/propel/dialog";
// icons

type Props = {
  fullScreen: boolean;
  handleClose: () => void;
  setFullScreen: React.Dispatch<React.SetStateAction<boolean>>;
  title: string;
  onRefresh: () => void;
};

export function WorkItemsModalHeader(props: Props) {
  const { fullScreen, handleClose, setFullScreen, title, onRefresh } = props;

  return (
    <div className="flex items-center justify-between gap-4 bg-surface-1 px-5 py-4 text-13">
      <div className="min-w-0">
        <Dialog.Title className="text-13 break-words">Analytics for {title}</Dialog.Title>
        <Dialog.Description className="mt-1 text-11 text-secondary">
          Paginated report · Refresh for updated results.
        </Dialog.Description>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Refresh analytics"
          title="Refresh analytics"
          onClick={onRefresh}
          className="grid place-items-center p-1 text-secondary hover:text-primary"
        >
          <RefreshCw size={14} />
        </button>
        <button
          type="button"
          className="hidden place-items-center p-1 text-secondary hover:text-primary md:grid"
          aria-label={fullScreen ? "Exit fullscreen" : "Expand analytics"}
          onClick={() => setFullScreen((prevData) => !prevData)}
        >
          {fullScreen ? <Shrink size={14} strokeWidth={2} /> : <Expand size={14} strokeWidth={2} />}
        </button>
        <button
          type="button"
          className="grid place-items-center p-1 text-secondary hover:text-primary"
          aria-label="Close analytics"
          onClick={handleClose}
        >
          <CloseIcon height={14} width={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
