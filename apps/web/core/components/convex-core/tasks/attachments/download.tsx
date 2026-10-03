import { useEffect, useRef, useState } from "react";
import { getAuthToken } from "@/components/convex-core/provider";
import { useConvex } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { AssetTransfers } from "../../documents/asset-transfers";
export function AttachmentDownload({ taskId, assetId, name }: { taskId: Id<"tasks">; assetId: string; name: string }) {
  const client = useConvex();
  return (
    <FileAttachmentDownload
      name={name}
      resolveFile={() => client.query(api.assets.taskAttachments.get, { taskId, assetId })}
    />
  );
}
export function FileAttachmentDownload({
  name,
  resolveFile,
}: {
  name: string;
  resolveFile: () => Promise<Pick<FunctionReturnType<typeof api.assets.index.get>, "name" | "downloadPath">>;
}) {
  const [transfers] = useState(() => new AssetTransfers());
  const lastDownload = useRef<string | null>(null);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  useEffect(() => () => transfers.dispose(), [transfers]);
  return (
    <div className="space-y-1">
      <Button
        variant="secondary"
        loading={pending}
        aria-label={`Download ${name}`}
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            await transfers.run(async (signal) => {
              if (!import.meta.env.VITE_CONVEX_SITE_URL) throw new Error("Attachment download is unavailable.");
              const file = await resolveFile();
              signal.throwIfAborted();
              const response = await fetch(new URL(file.downloadPath, import.meta.env.VITE_CONVEX_SITE_URL), {
                headers: { Authorization: `Bearer ${await getAuthToken()}` },
                credentials: "omit",
                cache: "no-store",
                signal,
              });
              if (!response.ok) throw new Error("File is unavailable or access changed.");
              const url = transfers.objectUrl(await response.blob(), signal);
              if (lastDownload.current) transfers.release(lastDownload.current);
              lastDownload.current = url;
              const anchor = document.createElement("a");
              anchor.href = url;
              anchor.download = file.name;
              anchor.click();
            });
          } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Download failed.");
          } finally {
            setPending(false);
          }
        }}
      >
        Download
      </Button>
      {error && (
        <p role="alert" className="text-12 text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}
