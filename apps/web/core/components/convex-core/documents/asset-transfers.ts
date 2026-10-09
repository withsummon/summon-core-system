import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { getAuthToken } from "@/components/convex-core/provider";
/** Owns browser-only bytes and URLs for one mounted document editor. */
export class AssetTransfers {
  private controllers = new Set<AbortController>();
  private urls = new Set<string>();

  async run<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    this.controllers.add(controller);
    try {
      return await operation(controller.signal);
    } finally {
      this.controllers.delete(controller);
    }
  }

  async download(
    asset: Pick<FunctionReturnType<typeof api.assets.index.get>, "downloadPath" | "size" | "downloadChunkBytes">,
    signal: AbortSignal
  ) {
    if (!import.meta.env.VITE_CONVEX_SITE_URL) throw new Error("File download is unavailable.");
    const blobs: Blob[] = [];
    const step = asset.downloadChunkBytes ?? asset.size;
    for (let offset = 0; offset < asset.size; offset += step) {
      const end = Math.min(offset + step, asset.size) - 1;
      // eslint-disable-next-line no-await-in-loop -- Each authenticated bounded range must finish before the next.
      const response = await fetch(new URL(asset.downloadPath, import.meta.env.VITE_CONVEX_SITE_URL), {
        headers: {
          // eslint-disable-next-line no-await-in-loop -- Refresh native credentials for every private range.
          Authorization: `Bearer ${await getAuthToken()}`,
          ...(asset.downloadChunkBytes ? { Range: `bytes=${offset}-${end}` } : {}),
        },
        credentials: "omit",
        cache: "no-store",
        signal,
      });
      if (
        !response.ok ||
        (asset.downloadChunkBytes &&
          (response.status !== 206 || response.headers.get("content-range") !== `bytes ${offset}-${end}/${asset.size}`))
      ) {
        // eslint-disable-next-line no-await-in-loop -- Release a rejected response before leaving the transfer.
        await response.body?.cancel();
        throw new Error("File is unavailable or your access changed.");
      }
      // eslint-disable-next-line no-await-in-loop -- Retain only one verified bounded response at a time.
      const blob = await response.blob();
      if (blob.size !== end - offset + 1) throw new Error("File download is incomplete.");
      blobs.push(blob);
    }
    return new Blob(blobs, { type: blobs[0]?.type });
  }

  objectUrl(blob: Blob, signal: AbortSignal) {
    signal.throwIfAborted();
    const url = URL.createObjectURL(blob);
    this.urls.add(url);
    return url;
  }

  release(url: string) {
    if (this.urls.delete(url)) URL.revokeObjectURL(url);
  }

  cancel() {
    for (const controller of this.controllers) controller.abort();
    this.controllers.clear();
  }

  dispose() {
    this.cancel();
    for (const url of this.urls) URL.revokeObjectURL(url);
    this.urls.clear();
  }
}

export async function uploadedStorageId(response: Response) {
  if (!response.ok) throw new Error("File upload failed. Try again.");
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || !("storageId" in result) || typeof result.storageId !== "string")
    throw new Error("The upload service returned an invalid file reference.");
  return result.storageId;
}
