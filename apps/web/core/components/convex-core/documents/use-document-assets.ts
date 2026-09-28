import { useMemo, useState } from "react";
import { useConvex, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import type { TFileHandler } from "@plane/editor";
import { useDocumentAssetReader } from "./use-document-asset-reader";
import { uploadFileAsset } from "../assets/upload-file";

export function useDocumentAssets(documentId: Id<"documents">) {
  const client = useConvex();
  const document = useQuery(api.documents.index.get, { documentId });
  const policy = useQuery(api.assets.index.policy, {});
  const [assetsUploadStatus, setStatus] = useState<Record<string, number>>({});
  const { lifecycle, transfers, resolve, source } = useDocumentAssetReader(documentId);
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
          setStatus((current) => ({ ...current, [blockId]: 0 }));
          try {
            const assetId = await uploadFileAsset(
              file,
              policy,
              (metadata) =>
                client.mutation(api.assets.index.prepare, {
                  ...metadata,
                  workspaceId,
                  projectId: null,
                  documentId,
                }),
              (args) => client.action(api.assets.upload.finalize, args),
              signal
            );
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
