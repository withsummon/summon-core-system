import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentProps } from "react";
import { useConvex, useQuery } from "convex/react";
import type { TFileHandler } from "@plane/editor";
import { api } from "@summon/convex/api";
import type { FunctionArgs } from "convex/server";
import { TaskRichEditor } from "./rich-editor";
import { useEditorAssetReader } from "../assets/use-editor-asset-reader";
import { uploadFileAsset } from "../assets/upload-file";

type Props = Omit<ComponentProps<typeof TaskRichEditor>, "imageFileHandler"> & {
  target: FunctionArgs<typeof api.assets.upload.duplicateDescriptionImage>["target"];
  onUploadingChange?: (uploading: boolean) => void;
};
export function TaskDescriptionEditor(props: Props) {
  return <BoundEditor key={"taskId" in props.target ? props.target.taskId : props.target.draftId} {...props} />;
}
function BoundEditor({ target, onUploadingChange, ...editor }: Props) {
  const client = useConvex();
  const policy = useQuery(api.assets.index.policy, {});
  const resolve = useCallback(
    async (assetId: string) => {
      const asset =
        "taskId" in target
          ? await client.query(api.assets.taskAttachments.get, { ...target, assetId })
          : await client.query(api.assets.draftAttachments.get, { ...target, assetId });
      if (asset.status !== "ready") throw new Error("This image was removed. Restore it from attachments first.");
      return asset;
    },
    [client, target]
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
      // An acknowledged description save owns reference unlinking. Local delete/undo never retires
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
          return await client.action(api.assets.upload.duplicateDescriptionImage, { target, assetId: id });
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
              (metadata) =>
                "taskId" in target
                  ? client.mutation(api.assets.taskAttachments.prepare, { ...target, ...metadata })
                  : client.mutation(api.assets.draftAttachments.prepare, { ...target, ...metadata }),
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
  }, [policy, assetsUploadStatus, transfers, resolve, source, client, target]);
  if (!fileHandler) return <p role="status">Loading description editor…</p>;
  return <TaskRichEditor {...editor} imageFileHandler={fileHandler} />;
}
