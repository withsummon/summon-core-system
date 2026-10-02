import { useEffect, useState } from "react";
import { getAuthToken } from "@/components/convex-core/provider";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { cn } from "@plane/utils";
import { AssetTransfers } from "../documents/asset-transfers";
export function AuthenticatedAssetImage({
  asset,
  alt,
  className,
  compactName,
}: {
  asset: Pick<FunctionReturnType<typeof api.assets.index.get>, "downloadPath" | "size" | "downloadChunkBytes">;
  alt: string;
  className: string;
  compactName?: string;
}) {
  const { url, error } = useAuthenticatedAssetSource(asset, alt);
  if (compactName !== undefined) {
    return url ? (
      <img src={url} alt="" className={cn("shrink-0", className)} />
    ) : (
      <AssetInitial name={compactName} error={error} className={className} />
    );
  }
  if (error)
    return (
      <p role="alert" className="text-14 text-danger-primary">
        {error}
      </p>
    );
  return url ? <img src={url} alt={alt} className={className} /> : <p role="status">Loading {alt.toLowerCase()}…</p>;
}

/** The mounted preview owns authenticated bytes and revokes every browser URL on replacement/unmount. */
export function useAuthenticatedAssetSource(
  asset:
    | Pick<FunctionReturnType<typeof api.assets.index.get>, "downloadPath" | "size" | "downloadChunkBytes">
    | null
    | undefined,
  alt: string
) {
  const path = asset?.downloadPath;
  const size = asset?.size;
  const chunkBytes = asset?.downloadChunkBytes;
  const [source, setSource] = useState<{ path: string; url: string } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (!path || size === undefined) return;
    const transfers = new AssetTransfers();
    let active = true;
    setSource(null);
    setError("");
    void transfers
      .run(async (signal) => {
        if (!import.meta.env.VITE_CONVEX_SITE_URL) throw new Error(`${alt} preview is unavailable.`);
        const blobs: Blob[] = [];
        const step = chunkBytes ?? size;
        for (let offset = 0; offset < size; offset += step) {
          const end = Math.min(offset + step, size) - 1;
          // eslint-disable-next-line no-await-in-loop -- Each bounded private range must finish before requesting the next.
          const response = await fetch(new URL(path, import.meta.env.VITE_CONVEX_SITE_URL), {
            headers: {
              // eslint-disable-next-line no-await-in-loop -- Use the native session owner for every private range.
              Authorization: `Bearer ${await getAuthToken()}`,
              ...(chunkBytes ? { Range: `bytes=${offset}-${end}` } : {}),
            },
            credentials: "omit",
            cache: "no-store",
            signal,
          });
          if (
            !response.ok ||
            (chunkBytes &&
              (response.status !== 206 || response.headers.get("content-range") !== `bytes ${offset}-${end}/${size}`))
          ) {
            // eslint-disable-next-line no-await-in-loop -- Release the failed chunk before exiting the transfer.
            await response.body?.cancel();
            throw new Error(`The ${alt.toLowerCase()} could not be loaded. Your access may have changed.`);
          }
          // eslint-disable-next-line no-await-in-loop -- The server owns the range budget; retain only this verified chunk.
          const blob = await response.blob();
          if (blob.size !== end - offset + 1) throw new Error(`${alt} download is incomplete.`);
          blobs.push(blob);
        }
        const url = transfers.objectUrl(new Blob(blobs, { type: blobs[0]?.type }), signal);
        if (active) setSource({ path: path, url });
      })
      .catch((failure) => {
        if (active) setError(failure instanceof Error ? failure.message : `${alt} preview failed.`);
      });
    return () => {
      active = false;
      transfers.dispose();
    };
  }, [path, size, chunkBytes, alt]);
  const url = source && source.path === path ? source.url : null;
  return { url, error: path ? error : "" };
}

export function AssetInitial({ name, error, className }: { name: string; error?: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      title={error || undefined}
      className={cn(
        "grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent-primary text-12 font-semibold text-on-color",
        className
      )}
    >
      {name.slice(0, 1).toLocaleUpperCase()}
    </span>
  );
}
