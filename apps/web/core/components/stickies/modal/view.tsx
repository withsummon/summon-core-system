/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { RecentStickyIcon, PlusIcon, CloseIcon } from "@plane/propel/icons";
export function StickiesModalView({
  handleClose,
  creatingSticky,
  create,
  search,
  children,
}: {
  handleClose?: () => void;
  creatingSticky: boolean;
  create: () => void;
  search: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[620px] p-6 pb-0">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-secondary">
          <RecentStickyIcon className="size-5 flex-shrink-0 rotate-90" />
          <p className="text-18 font-medium">Your stickies</p>
        </div>
        <div className="flex gap-2">
          {search}
          <button
            onClick={create}
            className="my-auto flex gap-1 text-13 font-medium text-accent-primary"
            disabled={creatingSticky}
          >
            <PlusIcon className="my-auto size-4" />
            <span>Add sticky</span>
            {creatingSticky && (
              <div className="ml-2 flex items-center justify-center">
                <div
                  className="h-4 w-4 animate-spin rounded-full border-2 border-accent-strong border-t-transparent"
                  role="status"
                  aria-label="loading"
                />
              </div>
            )}
          </button>
          {handleClose && (
            <button
              type="button"
              aria-label="Close stickies"
              onClick={handleClose}
              className="my-auto grid flex-shrink-0 place-items-center rounded-sm p-1 text-tertiary transition-colors hover:bg-layer-1 hover:text-primary"
            >
              <CloseIcon className="size-4 text-placeholder" />
            </button>
          )}
        </div>
      </div>
      <div className="mb-4 max-h-[625px] overflow-scroll">{children}</div>
    </div>
  );
}
