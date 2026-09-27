import { useEffect, useState } from "react";
import { useAuthToken } from "@convex-dev/auth/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { AssetTransfers } from "../documents/asset-transfers";
export function AuthenticatedAssetImage({
  asset,
  alt,
  className,
  compactName,
}: {
  asset: Pick<FunctionReturnType<typeof api.assets.index.get>, "downloadPath">;
  alt: string;
  className: string;
  compactName?: string;
}) {
  const token = useAuthToken();
  const [source, setSource] = useState<{ path: string; url: string } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const transfers = new AssetTransfers();
    let active = true;
    setSource(null);
    setError("");
    void transfers
      .run(async (signal) => {
        if (!token || !import.meta.env.VITE_CONVEX_SITE_URL) throw new Error(`${alt} preview is unavailable.`);
        const response = await fetch(new URL(asset.downloadPath, import.meta.env.VITE_CONVEX_SITE_URL), {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "omit",
          cache: "no-store",
          signal,
        });
        if (!response.ok)
          throw new Error(`The ${alt.toLowerCase()} could not be loaded. Your access may have changed.`);
        const url = transfers.objectUrl(await response.blob(), signal);
        if (active) setSource({ path: asset.downloadPath, url });
      })
      .catch((failure) => {
        if (active) setError(failure instanceof Error ? failure.message : `${alt} preview failed.`);
      });
    return () => {
      active = false;
      transfers.dispose();
    };
  }, [asset.downloadPath, token, alt]);
  const url = source?.path === asset.downloadPath ? source.url : null;
  if (compactName !== undefined) {
    return url ? (
      <img src={url} alt="" className="h-6 w-6 shrink-0 rounded-md border border-subtle object-contain" />
    ) : (
      <AssetInitial name={compactName} error={error} />
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

export function AssetInitial({ name, error }: { name: string; error?: string }) {
  return (
    <span
      aria-hidden="true"
      title={error || undefined}
      className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent-primary text-12 font-semibold text-on-color"
    >
      {name.slice(0, 1).toLocaleUpperCase()}
    </span>
  );
}
