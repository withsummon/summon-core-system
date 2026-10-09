import { useEffect, useState } from "react";
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
        const blob = await transfers.download(
          { downloadPath: path, size, downloadChunkBytes: chunkBytes ?? null },
          signal
        );
        const url = transfers.objectUrl(blob, signal);
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
