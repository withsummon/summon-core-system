import { useEffect, useState } from "react";
import { useAction, useConvex, useMutation, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import type { FunctionReturnType } from "convex/server";
import { Button } from "@plane/propel/button";
import { mutationMessage } from "../commercial/forms";
import { AssetTransfers, uploadedStorageId } from "../documents/asset-transfers";
export function Attachments({
  conversationId,
  files,
  disabled,
  uploading,
  setUploading,
}: {
  conversationId: Id<"assistantConversations">;
  files: FunctionReturnType<typeof api.assistant.attachments.pending>;
  disabled: boolean;
  uploading: boolean;
  setUploading: (value: boolean) => void;
}) {
  const policy = useQuery(api.assistant.attachments.policy);
  const prepare = useMutation(api.assistant.attachments.prepare);
  const finalize = useAction(api.assistant.attachment_upload.finalize);
  const remove = useMutation(api.assistant.attachments.remove);
  const [transfers] = useState(() => new AssetTransfers());
  const [error, setError] = useState("");
  useEffect(() => () => transfers.dispose(), [transfers]);
  return (
    <div className="space-y-2 border-b border-subtle-1 pb-3">
      <label className="flex cursor-pointer flex-wrap items-center gap-2 text-14">
        <span>Attach files</span>
        <input
          type="file"
          multiple
          accept={policy?.files.map((file) => file.extension).join(",")}
          disabled={disabled || uploading || !policy || files.length >= policy.maxAttachments}
          aria-label="Attach files"
          className="max-w-full text-12"
          onChange={async (event) => {
            const selected = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (!policy) return;
            setError("");
            setUploading(true);
            try {
              if (files.length + selected.length > policy.maxAttachments)
                throw new Error("Attach up to five files per message.");
              const batch = selected.map((file) => {
                const type = policy.files.find(({ extension }) => file.name.toLowerCase().endsWith(extension));
                if (!type || file.size < 1 || file.size > type.maxBytes)
                  throw new Error("Choose documents up to 10 MB or MP3/M4A recordings up to 250 MB.");
                return { file, contentType: type.contentType };
              });
              const failures: string[] = [];
              for (const { file, contentType } of batch) {
                try {
                  // eslint-disable-next-line no-await-in-loop -- Hash and upload one recording at a time to bound browser memory.
                  await transfers.run(async (signal) => {
                    signal.throwIfAborted();
                    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
                    const sha256 = btoa(String.fromCharCode(...digest));
                    const ticket = await prepare({
                      conversationId,
                      name: file.name,
                      contentType,
                      size: file.size,
                      sha256,
                    });
                    signal.throwIfAborted();
                    const response = await fetch(ticket.uploadUrl, {
                      method: "POST",
                      headers: { "Content-Type": contentType },
                      body: file,
                      signal,
                    });
                    const storageId = await uploadedStorageId(response);
                    signal.throwIfAborted();
                    await finalize({ attachmentId: ticket.attachmentId, storageId });
                  });
                } catch (failure) {
                  failures.push(mutationMessage(failure));
                }
              }
              if (failures.length)
                setError(
                  `${failures.length} file upload${failures.length === 1 ? "" : "s"} failed. ${failures.join(" ")}`
                );
            } catch (failure) {
              setError(failure instanceof Error ? failure.message : "Upload failed.");
            } finally {
              setUploading(false);
            }
          }}
        />
      </label>
      <p className="text-12 text-secondary">Documents · 10 MB each; MP3 or M4A · 250 MB each · up to five files</p>
      <ul className="space-y-2">
        {files.map((file) => (
          <li
            key={file._id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-layer-1 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-14 break-all">{file.name}</p>
              <p className="text-12 text-secondary">
                {file.status}
                {file.truncated ? " · text shortened to 30,000 characters" : ""}
              </p>
              {file.error && (
                <p role="alert" className="text-12 text-danger-primary">
                  {file.error}
                </p>
              )}
            </div>
            <Button
              variant="secondary"
              disabled={disabled || uploading}
              onClick={async () => {
                try {
                  await remove({ attachmentId: file._id });
                } catch (failure) {
                  setError(mutationMessage(failure));
                }
              }}
            >
              Remove file
            </Button>
          </li>
        ))}
      </ul>
      {uploading && (
        <p role="status" className="text-12">
          Uploading files…
        </p>
      )}
      {error && (
        <p role="alert" className="text-12 text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}
export function AttachmentDownload({
  conversationId,
  attachmentId,
  name,
}: {
  conversationId: Id<"assistantConversations">;
  attachmentId: string;
  name: string;
}) {
  const convex = useConvex();
  const [transfers] = useState(() => new AssetTransfers());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => transfers.dispose(), [transfers]);
  return (
    <div>
      <Button
        variant="secondary"
        loading={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            await transfers.run(async (signal) => {
              const descriptor = await convex.query(api.assistant.attachments.download, {
                conversationId,
                attachmentId,
              });
              signal.throwIfAborted();
              const url = transfers.objectUrl(await transfers.download(descriptor, signal), signal);
              const anchor = document.createElement("a");
              anchor.href = url;
              anchor.download = descriptor.name;
              anchor.click();
            });
          } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Download failed.");
          } finally {
            setPending(false);
          }
        }}
      >
        Download {name}
      </Button>
      {error && (
        <p role="alert" className="text-12 text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}
