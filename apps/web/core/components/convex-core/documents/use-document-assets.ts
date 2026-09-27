import { useMemo, useState } from "react";
import { useConvex, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import type { TFileHandler } from "@plane/editor";
import { useDocumentAssetReader } from "./use-document-asset-reader";
import { uploadedStorageId } from "./asset-transfers";

export function useDocumentAssets(documentId: Id<"documents">, getToken: () => string) {
  const client = useConvex();
  const document = useQuery(api.documents.index.get, { documentId });
  const policy = useQuery(api.assets.index.policy, {});
  const [assetsUploadStatus, setStatus] = useState<Record<string, number>>({});
  const { lifecycle, transfers, resolve, source } = useDocumentAssetReader(documentId, getToken);
  const siteUrl = import.meta.env.VITE_CONVEX_SITE_URL;
  const workspaceId = document?.workspaceId;
  const handlers = useMemo(() => {
    if (!workspaceId || !policy || !siteUrl) return null;
    return {
      cancel: () => {
        transfers.cancel();
        setStatus({});
      },
      checkIfAssetExists: async (assetId) => (await resolve(assetId)) !== null,
      delete: (assetId) =>
        lifecycle.run(assetId, async () => {
          const asset = await resolve(assetId);
          if (asset) await client.mutation(api.assets.index.remove, { assetId: asset.id });
        }),
      restore: (assetId) =>
        lifecycle.run(assetId, async () => {
          await client.mutation(api.assets.index.restore, { documentId, assetId });
        }),
      duplicate: (assetId) => client.action(api.assets.upload.duplicate, { documentId, assetId }),
      getAssetSrc: (assetId) => source(assetId, false),
      getAssetDownloadSrc: (assetId) => source(assetId, true),
      upload: (blockId, file) =>
        transfers.run(async (signal) => {
          if (!policy.supportedTypes.some((type) => type === file.type))
            throw new Error("This file type is not supported.");
          const limit = file.type.startsWith("image/") ? policy.imageMaxBytes : policy.maxBytes;
          if (file.size < 1 || file.size > limit) throw new Error(`Choose a file up to ${limit / 1024 / 1024} MB.`);
          setStatus((current) => ({ ...current, [blockId]: 0 }));
          try {
            const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
            const sha256 = btoa(String.fromCharCode(...digest));
            signal.throwIfAborted();
            const ticket = await client.mutation(api.assets.index.prepare, {
              workspaceId,
              projectId: null,
              documentId,
              name: file.name,
              contentType: file.type,
              size: file.size,
              sha256,
            });
            signal.throwIfAborted();
            const response = await fetch(ticket.uploadUrl, {
              method: "POST",
              headers: { "Content-Type": file.type },
              body: file,
              signal,
              credentials: "omit",
            });
            const storageId = await uploadedStorageId(response);
            signal.throwIfAborted();
            const assetId = await client.action(api.assets.upload.finalize, { assetId: ticket.assetId, storageId });
            signal.throwIfAborted();
            setStatus((current) => ({ ...current, [blockId]: 100 }));
            return assetId;
          } finally {
            if (!signal.aborted)
              setStatus((current) => {
                const next = { ...current };
                delete next[blockId];
                return next;
              });
          }
        }),
      validation: { maxFileSize: policy.imageMaxBytes },
    } satisfies Omit<TFileHandler, "assetsUploadStatus">;
  }, [client, documentId, workspaceId, policy, siteUrl, transfers, lifecycle, resolve, source]);
  return handlers ? { ...handlers, assetsUploadStatus } : null;
}
