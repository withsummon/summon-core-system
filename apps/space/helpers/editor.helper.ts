/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { useConvex, useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
import type { TFileHandler } from "@plane/editor";
import { getAuthToken } from "@/app/providers";
import { useUser } from "@/hooks/store/use-user";

export type EditorTarget =
  | Omit<FunctionArgs<typeof api.publicSharing.index.resolveDescriptionImage>, "assetId">
  | {
      comment: FunctionArgs<typeof api.assets.index.resolveCommentImage>["target"];
    };

export function getEditorAssetSrc(target: EditorTarget, assetId: string) {
  const site = import.meta.env.VITE_CONVEX_SITE_URL;
  if (!site) throw new Error("File storage is not configured.");
  const url = new URL(`/assets/${encodeURIComponent(assetId)}`, site);
  if ("comment" in target) {
    if ("commentId" in target.comment && target.comment.anchor !== null) {
      url.searchParams.set("anchor", target.comment.anchor);
      url.searchParams.set("task", target.comment.taskId);
      url.searchParams.set("comment", target.comment.commentId);
    }
  } else {
    url.searchParams.set("anchor", target.anchor);
    url.searchParams.set("task", target.taskId);
  }
  return url.toString();
}

export function useEditorFileHandlers(target: EditorTarget): TFileHandler | null {
  const client = useConvex();
  const { isAuthenticated } = useUser();
  const policy = useQuery(api.assets.index.policy, "comment" in target && isAuthenticated ? {} : "skip");
  const [assetsUploadStatus, setStatus] = useState<Record<string, number>>({});
  const controllers = useRef(new Set<AbortController>());
  const objectUrls = useRef(new Set<string>());
  const cancel = () => {
    for (const controller of controllers.current) controller.abort();
    controllers.current.clear();
  };
  useEffect(() => {
    const transfers = controllers.current;
    const urls = objectUrls.current;
    return () => {
      for (const controller of transfers) controller.abort();
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);
  const resolve = (assetId: string) =>
    "comment" in target
      ? client.query(api.assets.index.resolveCommentImage, { target: target.comment, assetId })
      : client.query(api.publicSharing.index.resolveDescriptionImage, { ...target, assetId });
  const source = async (assetId: string) => {
    const asset = await resolve(assetId);
    if (!asset) throw new Error("This image is unavailable.");
    const site = import.meta.env.VITE_CONVEX_SITE_URL;
    if (!site) throw new Error("File storage is not configured.");
    const url = new URL(asset.downloadPath, site);
    if (url.searchParams.has("anchor")) return url.toString();
    const controller = new AbortController();
    controllers.current.add(controller);
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${await getAuthToken()}` },
        redirect: "error",
        credentials: "omit",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("This image could not be loaded.");
      const blob = await response.blob();
      controller.signal.throwIfAborted();
      const objectUrl = URL.createObjectURL(blob);
      objectUrls.current.add(objectUrl);
      return objectUrl;
    } finally {
      controllers.current.delete(controller);
    }
  };
  if ("comment" in target && isAuthenticated && policy === undefined) return null;
  return {
    assetsUploadStatus,
    cancel,
    checkIfAssetExists: async (id) => (await resolve(id)) !== null,
    getAssetSrc: source,
    getAssetDownloadSrc: source,
    // Saving the comment owns unlinking. Local delete/undo must retain its bytes.
    delete: () => Promise.resolve(),
    restore: async (id) => {
      if (!(await resolve(id))) throw new Error("This image is unavailable.");
    },
    duplicate: async (assetId) => {
      if (!("comment" in target)) throw new Error("Published descriptions are read-only.");
      return client.action(api.assets.upload.duplicateDescriptionImage, { target, assetId });
    },
    upload: async (blockId, file) => {
      if (!("comment" in target) || !policy) throw new Error("Sign in before uploading a comment image.");
      const controller = new AbortController();
      controllers.current.add(controller);
      setStatus((current) => ({ ...current, [blockId]: 0 }));
      try {
        const bytes = await file.arrayBuffer();
        controller.signal.throwIfAborted();
        const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
        controller.signal.throwIfAborted();
        const ticket = await client.mutation(api.assets.index.preparePublicCommentImage, {
          target: target.comment,
          name: file.name,
          contentType: file.type,
          size: file.size,
          sha256: btoa(String.fromCharCode(...digest)),
        });
        controller.signal.throwIfAborted();
        const response = await fetch(ticket.uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
          credentials: "omit",
          redirect: "error",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("The image upload failed.");
        const result: unknown = await response.json();
        if (!result || typeof result !== "object" || !("storageId" in result) || typeof result.storageId !== "string")
          throw new Error("The upload returned no storage ID.");
        controller.signal.throwIfAborted();
        return await client.action(api.assets.upload.finalize, {
          assetId: ticket.assetId,
          storageId: result.storageId,
        });
      } finally {
        controllers.current.delete(controller);
        setStatus((current) => {
          const next = { ...current };
          delete next[blockId];
          return next;
        });
      }
    },
    validation: { maxFileSize: policy ? policy.imageMaxBytes : 0 },
  };
}
