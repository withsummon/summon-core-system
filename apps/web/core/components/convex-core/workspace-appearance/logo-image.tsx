import { useEffect, useState } from "react";
import { useAuthToken } from "@convex-dev/auth/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { AssetTransfers } from "../documents/asset-transfers";
export function LogoImage({ logo }: { logo: NonNullable<FunctionReturnType<typeof api.settings.logo.get>["logo"]> }) {
  const token = useAuthToken();
  const [source, setSource] = useState<string | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const transfers = new AssetTransfers();
    let active = true;
    setSource(null);
    setError("");
    void transfers
      .run(async (signal) => {
        if (!token || !import.meta.env.VITE_CONVEX_SITE_URL) throw new Error("Logo preview is unavailable.");
        const response = await fetch(new URL(logo.downloadPath, import.meta.env.VITE_CONVEX_SITE_URL), {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "omit",
          cache: "no-store",
          signal,
        });
        if (!response.ok) throw new Error("The logo could not be loaded. Your access may have changed.");
        const url = transfers.objectUrl(await response.blob(), signal);
        if (active) setSource(url);
      })
      .catch((failure) => {
        if (active) setError(failure instanceof Error ? failure.message : "Logo preview failed.");
      });
    return () => {
      active = false;
      transfers.dispose();
    };
  }, [logo.downloadPath, token]);
  if (error)
    return (
      <p role="alert" className="text-14 text-danger-primary">
        {error}
      </p>
    );
  return source ? (
    <img src={source} alt="Workspace logo" className="h-20 w-20 rounded-md border border-subtle object-contain" />
  ) : (
    <p role="status">Loading logo…</p>
  );
}
