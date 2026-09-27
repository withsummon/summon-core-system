import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { AssetTransfers, uploadedStorageId } from "../../documents/asset-transfers";
import { attachmentContentType } from "./upload-file";
export function AttachmentUpload({ taskId }: { taskId: Id<"tasks"> }) {
  const prepare = useMutation(api.assets.taskAttachments.prepare);
  return <FileAttachmentUpload prepare={(file) => prepare({ taskId, ...file })} />;
}
export function FileAttachmentUpload({
  prepare,
  label = "Attach a file",
  supportedTypes,
}: {
  label?: string;
  supportedTypes?: readonly string[];
  prepare: (
    file: Omit<FunctionArgs<typeof api.assets.taskAttachments.prepare>, "taskId">
  ) => Promise<FunctionReturnType<typeof api.assets.taskAttachments.prepare>>;
}) {
  const policy = useQuery(api.assets.index.policy, {});
  const finalize = useAction(api.assets.upload.finalize);
  const [transfers] = useState(() => new AssetTransfers());
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  useEffect(() => () => transfers.dispose(), [transfers]);
  return (
    <div className="space-y-2">
      <label className="flex flex-wrap items-center gap-2 text-14">
        <span>{label}</span>
        <input
          aria-label={label}
          className="max-w-full text-12"
          type="file"
          disabled={pending || !policy}
          accept={supportedTypes?.join(",") ?? (policy ? Object.keys(policy.typesByExtension).join(",") : undefined)}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file || !policy) return;
            setPending(true);
            setError("");
            try {
              const contentType = attachmentContentType(file, policy);
              if (supportedTypes && !supportedTypes.includes(contentType)) throw new Error("Choose a supported image.");
              await transfers.run(async (signal) => {
                const bytes = await file.arrayBuffer();
                signal.throwIfAborted();
                const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
                signal.throwIfAborted();
                const ticket = await prepare({
                  name: file.name,
                  contentType,
                  size: file.size,
                  sha256: btoa(String.fromCharCode(...digest)),
                });
                signal.throwIfAborted();
                const response = await fetch(ticket.uploadUrl, {
                  method: "POST",
                  headers: { "Content-Type": contentType },
                  body: new Blob([bytes], { type: contentType }),
                  signal,
                  credentials: "omit",
                });
                const storageId = await uploadedStorageId(response);
                signal.throwIfAborted();
                await finalize({ assetId: ticket.assetId, storageId });
                signal.throwIfAborted();
              });
            } catch (failure) {
              setError(failure instanceof Error ? failure.message : "Upload failed.");
            } finally {
              setPending(false);
            }
          }}
        />
      </label>
      {policy && <UploadPolicy policy={policy} supportedTypes={supportedTypes} />}
      {pending && (
        <div className="flex flex-wrap items-center gap-2">
          <p role="status" className="text-14">
            Uploading and checking file…
          </p>
          <Button variant="secondary" onClick={() => transfers.cancel()}>
            Cancel transfer
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}

function UploadPolicy({
  policy,
  supportedTypes,
}: {
  policy: FunctionReturnType<typeof api.assets.index.policy>;
  supportedTypes?: readonly string[];
}) {
  return (
    <p className="text-12 text-secondary">
      {supportedTypes ? supportedTypes.join(", ") : Object.keys(policy.typesByExtension).join(", ")} · images up to{" "}
      {policy.imageMaxBytes / 1024 / 1024} MB
      {!supportedTypes && ` · other files up to ${policy.maxBytes / 1024 / 1024} MB`}
    </p>
  );
}
