/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { XCircle } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
// plane imports
import { PROFILE_SETTINGS_TRACKER_ELEMENTS } from "@plane/constants";
import { Tooltip } from "@plane/propel/tooltip";
import { renderFormattedDate, calculateTimeAgo, renderFormattedTime } from "@plane/utils";
// components
import { DeleteApiTokenModal } from "@/components/api-token/delete-token-modal";
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";

type Props = {
  token: FunctionReturnType<typeof api.identity.apiTokens.list>["page"][number];
};

export function ApiTokenListItem(props: Props) {
  const { token } = props;
  // states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  // hooks
  const { isMobile } = usePlatformOS();
  const expiresAt = token.expiresAt == null ? null : new Date(token.expiresAt);
  const active = token.enabled && (expiresAt === null || expiresAt.getTime() > Date.now());

  return (
    <>
      <DeleteApiTokenModal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} tokenId={token._id} />
      <div className="group relative flex flex-col justify-center border-b border-subtle py-3">
        <Tooltip tooltipContent="Delete token" isMobile={isMobile}>
          <button
            onClick={() => setDeleteModalOpen(true)}
            aria-label={`Delete ${token.name} token`}
            className="absolute right-4 grid place-items-center md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
            data-ph-element={PROFILE_SETTINGS_TRACKER_ELEMENTS.LIST_ITEM_DELETE_ICON}
          >
            <XCircle className="h-4 w-4 text-danger-primary" />
          </button>
        </Tooltip>
        <div className="flex w-4/5 items-center">
          <h5 className="truncate text-13 font-medium">{token.name}</h5>
          <span
            className={`${
              active ? "bg-success-subtle text-success-primary" : "bg-layer-1 text-placeholder"
            } ml-2 flex h-4 max-h-fit items-center rounded-xs px-2 text-11 font-medium`}
          >
            {active ? "Active" : "Expired"}
          </span>
        </div>
        <div className="mt-1 flex w-full flex-col justify-center">
          {token.metadata?.description && (
            <p className="mb-1 max-w-[70%] text-13 break-words">{token.metadata.description}</p>
          )}
          <p className="mb-1 text-11 leading-6 text-placeholder">
            {active
              ? expiresAt
                ? `Expires ${renderFormattedDate(expiresAt)} at ${renderFormattedTime(expiresAt)}`
                : "Never expires"
              : `Expired ${calculateTimeAgo(expiresAt)}`}
          </p>
        </div>
      </div>
    </>
  );
}
