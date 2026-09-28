import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { uploadedStorageId } from "../documents/asset-transfers.ts";
import { attachmentContentType } from "../tasks/attachments/upload-file.ts";

type Prepare = (
  file: Omit<FunctionArgs<typeof api.assets.taskAttachments.prepare>, "taskId">
) => Promise<FunctionReturnType<typeof api.assets.taskAttachments.prepare>>;
export async function uploadFileAsset<Result>(
  file: File,
  policy: FunctionReturnType<typeof api.assets.index.policy>,
  prepare: Prepare,
  finalize: (args: FunctionArgs<typeof api.assets.upload.finalize>) => Promise<Result>,
  signal: AbortSignal
) {
  const contentType = attachmentContentType(file, policy);
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
  const result = await finalize({ assetId: ticket.assetId, storageId });
  signal.throwIfAborted();
  return result;
}
