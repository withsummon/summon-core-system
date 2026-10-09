import { useCallback } from "react";
import { useConvex } from "convex/react";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { useEditorAssetReader } from "../assets/use-editor-asset-reader";

export function useDocumentAssetReader(documentId: Id<"documents">) {
  const client = useConvex();
  const resolve = useCallback(
    (assetId: string) => client.query(api.assets.index.resolveDocumentAsset, { documentId, assetId }),
    [client, documentId]
  );
  return useEditorAssetReader(resolve);
}
