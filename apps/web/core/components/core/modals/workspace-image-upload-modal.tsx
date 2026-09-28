/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { UserImageUploadDialog } from "./user-image-upload-dialog";
import { AuthenticatedAssetImage } from "@/components/convex-core/assets/image";
import { uploadFileAsset } from "@/components/convex-core/assets/upload-file";

export function WorkspaceImageUploadModal({
  workspaceId,
  appearance,
  expectedRevision,
  onSuccess,
  onClose,
}: {
  workspaceId: Id<"workspaces">;
  appearance: FunctionReturnType<typeof api.settings.logo.get>;
  expectedRevision: number;
  onSuccess: (receipt: FunctionReturnType<typeof api.settings.logo.remove>) => void;
  onClose: () => void;
}) {
  const transfer = useRef<AbortController | null>(null);
  useEffect(() => () => transfer.current?.abort(), []);
  const policy = useQuery(api.assets.index.policy);
  const prepare = useMutation(api.settings.logo.prepare);
  const finalize = useAction(api.settings.logo.finalize);
  const remove = useMutation(api.settings.logo.remove);
  if (!policy) return <p role="status">Loading workspace image…</p>;
  return (
    <UserImageUploadDialog
      isOpen
      onClose={onClose}
      imageAlt="Workspace logo"
      currentImage={
        appearance.logo ? (
          <AuthenticatedAssetImage
            key={appearance.logo.id}
            asset={appearance.logo}
            alt="Workspace logo"
            className="absolute top-0 left-0 h-full w-full rounded-md object-cover"
          />
        ) : null
      }
      onUpload={async (file) => {
        const controller = new AbortController();
        transfer.current = controller;
        try {
          const receipt = await uploadFileAsset(
            file,
            policy,
            (metadata) => prepare({ ...metadata, workspaceId, expectedRevision }),
            finalize,
            controller.signal
          );
          onSuccess(receipt);
        } finally {
          transfer.current = null;
        }
      }}
      onRemove={async () => {
        if (!appearance.logo) return;
        onSuccess(await remove({ workspaceId, assetId: appearance.logo.id, expectedRevision }));
      }}
    />
  );
}
