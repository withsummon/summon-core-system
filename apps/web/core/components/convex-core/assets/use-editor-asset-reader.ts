import { useEffect, useMemo, useState } from "react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { AssetLifecycle } from "../documents/asset-lifecycle";
import { AssetTransfers } from "../documents/asset-transfers";

type Descriptor = Pick<FunctionReturnType<typeof api.assets.index.get>, "downloadPath">;
/** Mounted editor owns authenticated bytes/URLs; the supplied canonical resolver owns its exact entity binding. */
export function useEditorAssetReader<T extends Descriptor>(
  resolve: (id: string) => Promise<T | null>,
  getToken: () => string
) {
  const [lifecycle] = useState(() => new AssetLifecycle());
  const [transfers] = useState(() => new AssetTransfers());
  const siteUrl = import.meta.env.VITE_CONVEX_SITE_URL;
  useEffect(() => () => transfers.dispose(), [transfers]);
  return useMemo(() => {
    const read = async (assetId: string, signal: AbortSignal) => {
      if (!siteUrl) throw new Error("File storage is not configured.");
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
  }, [resolve, getToken, siteUrl, lifecycle, transfers]);
}
