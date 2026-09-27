import { useEffect, useMemo, useState } from "react";
import { useConvex } from "convex/react";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { AssetLifecycle } from "./asset-lifecycle";
import { AssetTransfers } from "./asset-transfers";

/** One mounted document's authenticated bytes, ordered with its local asset mutations. */
export function useDocumentAssetReader(documentId: Id<"documents">, getToken: () => string) {
  const client = useConvex();
  const [lifecycle] = useState(() => new AssetLifecycle());
  const [transfers] = useState(() => new AssetTransfers());
  const siteUrl = import.meta.env.VITE_CONVEX_SITE_URL;
  useEffect(() => () => transfers.dispose(), [transfers]);
  return useMemo(() => {
    const resolve = (assetId: string) => client.query(api.assets.index.resolveDocumentAsset, { documentId, assetId });
    const read = async (assetId: string, signal: AbortSignal) => {
      if (!siteUrl) throw new Error("Document file storage is not configured.");
      await lifecycle.wait(assetId);
      const asset = await resolve(assetId);
      signal.throwIfAborted();
      if (!asset) throw new Error("This file is unavailable.");
      const response = await fetch(new URL(asset.downloadPath, siteUrl), {
        headers: { Authorization: `Bearer ${getToken()}` },
        credentials: "omit",
        cache: "no-store",
        signal,
      });
      if (!response.ok)
        throw new Error(
          response.status === 403 || response.status === 401
            ? "You no longer have access to this file."
            : "The file could not be loaded."
        );
      const blob = await response.blob();
      signal.throwIfAborted();
      return { asset, blob };
    };
    const source = (assetId: string, download: boolean) =>
      transfers.run(async (signal) => {
        const { blob } = await read(assetId, signal);
        return transfers.objectUrl(download ? new Blob([blob], { type: "application/octet-stream" }) : blob, signal);
      });
    return { resolve, source, read, lifecycle, transfers };
  }, [client, documentId, getToken, siteUrl, lifecycle, transfers]);
}
