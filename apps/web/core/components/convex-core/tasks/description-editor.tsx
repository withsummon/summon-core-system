import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentProps } from "react";
import { useConvex, useQuery } from "convex/react";
import type { TFileHandler } from "@plane/editor";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { TaskRichEditor } from "./rich-editor";
import { useEditorAssetReader } from "../assets/use-editor-asset-reader";
import { uploadFileAsset } from "../assets/upload-file";

type Props = Omit<ComponentProps<typeof TaskRichEditor>, "imageFileHandler"> & {
  taskId: Id<"tasks">;
  onUploadingChange?: (uploading: boolean) => void;
};
export function TaskDescriptionEditor(props: Props) {
  return <BoundEditor key={props.taskId} {...props} />;
}
function BoundEditor({ taskId, onUploadingChange, ...editor }: Props) {
  const client = useConvex();
  const policy = useQuery(api.assets.index.policy, {});
  const resolve = useCallback(
    async (assetId: string) => {
      const asset = await client.query(api.assets.taskAttachments.get, { taskId, assetId });
      if (asset.status !== "ready") throw new Error("This image was removed. Restore it from task attachments first.");
      return asset;
    },
    [client, taskId]
  );
  const { source, transfers } = useEditorAssetReader(resolve);
  const [assetsUploadStatus, setStatus] = useState<Record<string, number>>({});
  const uploading = Object.keys(assetsUploadStatus).length > 0;
  useEffect(() => {
    onUploadingChange?.(uploading);
  }, [onUploadingChange, uploading]);
  const fileHandler = useMemo(() => {
    if (!policy) return null;
    return {
      assetsUploadStatus,
      cancel: () => {
        transfers.cancel();
        setStatus({});
      },
      checkIfAssetExists: async (id) => (await resolve(id)).status === "ready",
      // Explicit Save owns reference unlinking. Local delete/undo never retires
      // bytes needed by canceled drafts, saved history or another reference.
      delete: () => Promise.resolve(),
      restore: async (id) => {
        await resolve(id);
      },
      getAssetSrc: (id) => source(id, false),
      getAssetDownloadSrc: (id) => source(id, true),
      duplicate: async (id) => {
        const operation = `duplicate:${crypto.randomUUID()}`;
        setStatus((current) => ({ ...current, [operation]: 0 }));
        try {
          return await client.action(api.assets.upload.duplicateTaskImage, { taskId, assetId: id });
        } finally {
          setStatus((current) => {
            const next = { ...current };
            delete next[operation];
            return next;
          });
        }
      },
      upload: (blockId, file) =>
        transfers.run(async (signal) => {
          setStatus((current) => ({ ...current, [blockId]: 0 }));
          try {
            return await uploadFileAsset(
              file,
              policy,
              (metadata) => client.mutation(api.assets.taskAttachments.prepare, { taskId, ...metadata }),
              (args) => client.action(api.assets.upload.finalize, args),
              signal
            );
          } finally {
            if (!signal.aborted)
              setStatus((current) => {
                const next = { ...current };
                delete next[blockId];
                return next;
              });
          }
        }),
      validation: { maxFileSize: policy.imageMaxBytes },
    } satisfies TFileHandler;
  }, [policy, assetsUploadStatus, transfers, resolve, source, client, taskId]);
  if (!fileHandler) return <p role="status">Loading description editor…</p>;
  return <TaskRichEditor {...editor} imageFileHandler={fileHandler} />;
}
