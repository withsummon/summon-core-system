/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Effect, Schema } from "effect";
import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import sharp from "sharp";
import { api } from "@summon/convex/api";
import { memberLabel } from "@summon/convex/member-label";
import {
  getAllDocumentFormatsFromDocumentEditorBinaryData,
  getBinaryDataFromDocumentEditorHTMLString,
} from "@plane/editor/lib";
import { renderPlaneDocToPdfBuffer } from "@/lib/pdf";
import type { TPdfExportRequestBody } from "@/schema/pdf-export";
import {
  PdfExportError,
  PdfAuthenticationError,
  PdfAccessError,
  PdfContentFetchError,
  PdfNotFoundError,
  PdfGenerationError,
  PdfImageProcessingError,
  PdfMetadataFetchError,
} from "@/schema/pdf-export";
import { tryAsync, withTimeoutAndRetry } from "./effect-utils";

export const exportToPdf = (input: TPdfExportRequestBody, cookie: string, convexUrl: string, siteUrl: string) =>
  Effect.gen(function* () {
    const projectId = input.projectId;
    const response = yield* tryAsync(
      () =>
        fetch(new URL("/api/auth/convex/token", siteUrl), {
          headers: { Cookie: cookie },
          redirect: "error",
          signal: AbortSignal.timeout(7000),
        }),
      (cause) => new PdfContentFetchError({ message: "Authentication service is unavailable.", cause })
    ).pipe(withTimeoutAndRetry("authenticate export", { timeoutMs: 7000, maxRetries: 0 }));
    if (response.status === 401 || response.status === 403)
      return yield* Effect.fail(new PdfAuthenticationError({ message: "Authentication required." }));
    if (!response.ok)
      return yield* Effect.fail(new PdfContentFetchError({ message: "Authentication service is unavailable." }));
    const token = yield* tryAsync(
      async () => Schema.decodeUnknownPromise(Schema.Struct({ token: Schema.NonEmptyString }))(await response.json()),
      (cause) => new PdfContentFetchError({ message: "Authentication service returned an invalid response.", cause })
    ).pipe(withTimeoutAndRetry("read authentication response", { timeoutMs: 7000, maxRetries: 0 }));
    const client = new ConvexHttpClient(convexUrl);
    client.setAuth(token.token);
    const page = yield* tryAsync(
      async () => {
        if (!(await client.query(api.identity.session.status, {})).valid)
          throw new PdfAuthenticationError({ message: "Authentication required." });
        const { workspace } = await client.query(api.navigation.address.resolveWorkspace, {
          workspaceSlug: input.workspaceSlug,
        });
        const resolved = await client.query(api.documents.index.resolve, {
          workspaceId: workspace._id,
          projectId,
          documentId: input.pageId,
        });
        if (!resolved) throw new PdfNotFoundError({ message: "Page not found." });
        const snapshot = await client.query(api.documents.index.snapshot, {
          documentId: resolved.document._id,
          revision: resolved.document.revision,
        });
        return { workspaceId: workspace._id, document: resolved.document, snapshot };
      },
      (cause) =>
        Schema.is(PdfExportError)(cause)
          ? cause
          : cause instanceof ConvexError
            ? new PdfAccessError({ message: "Page access denied." })
            : new PdfContentFetchError({ message: "Failed to fetch page content.", cause })
    ).pipe(withTimeoutAndRetry("fetch page content", { timeoutMs: 7000, maxRetries: 3 }));
    // A new native document has the same empty initial editor content as collaboration/copy.
    const content = yield* tryAsync(
      () =>
        Promise.resolve(
          getAllDocumentFormatsFromDocumentEditorBinaryData(
            page.snapshot
              ? new Uint8Array(page.snapshot.descriptionBinary)
              : getBinaryDataFromDocumentEditorHTMLString("<p></p>", page.document.name)
          )
        ),
      (cause) => new PdfContentFetchError({ message: "Page content could not be decoded.", cause })
    );
    const images = new Set<string>();
    const mentions = new Set<string>();
    const nodes = [content.contentJSON];
    for (const node of nodes) {
      if (node.content) nodes.push(...node.content);
      if (
        (node.type === "imageComponent" || node.type === "image") &&
        typeof node.attrs?.src === "string" &&
        !node.attrs.src.startsWith("http") &&
        !node.attrs.src.startsWith("data:")
      )
        images.add(node.attrs.src);
      if (
        node.type === "mention" &&
        (node.attrs?.entity_name === "user_mention" || node.attrs?.entity_name === "user")
      ) {
        if (typeof node.attrs.entity_identifier === "string") mentions.add(node.attrs.entity_identifier);
        if (typeof node.attrs.id === "string") mentions.add(node.attrs.id);
      }
    }
    const userMentions = new Map<string, string>();
    const ids = [...mentions];
    for (let offset = 0; offset < ids.length; offset += 100) {
      const members = yield* tryAsync(
        () =>
          client.query(api.documents.mentions.resolve, {
            documentId: page.document._id,
            userIds: ids.slice(offset, offset + 100),
          }),
        (cause) =>
          cause instanceof ConvexError
            ? new PdfAccessError({ message: "Document member access denied." })
            : new PdfMetadataFetchError({
                message: "Document members are unavailable.",
                source: "user-mentions",
                cause,
              })
      ).pipe(withTimeoutAndRetry("fetch document members", { timeoutMs: 7000, maxRetries: 0 }));
      for (const { id, member } of members) userMentions.set(id, memberLabel(member));
    }
    const resolvedImageUrls: Record<string, string> = {};
    if (!input.noAssets)
      for (const [id, url] of yield* Effect.forEach(
        [...images],
        (assetId) =>
          Effect.gen(function* () {
            const asset = yield* tryAsync(
              () => client.query(api.assets.index.resolveDocumentAsset, { documentId: page.document._id, assetId }),
              (cause) =>
                cause instanceof ConvexError
                  ? new PdfAccessError({ message: "Document image access denied." })
                  : new PdfImageProcessingError({ message: "Image could not be resolved.", assetId, cause })
            );
            if (!asset) return [assetId, null] as const;
            const image = yield* tryAsync(
              () =>
                fetch(new URL(asset.downloadPath, siteUrl), {
                  headers: { Authorization: `Bearer ${token.token}` },
                  redirect: "error",
                  signal: AbortSignal.timeout(8000),
                }),
              (cause) => new PdfImageProcessingError({ message: "Image could not be loaded.", assetId, cause })
            );
            if (image.status === 401)
              return yield* Effect.fail(new PdfAuthenticationError({ message: "Authentication required." }));
            if (image.status === 403)
              return yield* Effect.fail(new PdfAccessError({ message: "Document image access denied." }));
            if (!image.ok) return [assetId, null] as const;
            const bytes = yield* tryAsync(
              async () =>
                sharp(Buffer.from(await image.arrayBuffer()))
                  .rotate()
                  .flatten({ background: "#ffffff" })
                  .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
                  .jpeg({ quality: 85 })
                  .toBuffer(),
              (cause) => new PdfImageProcessingError({ message: "Image could not be rendered.", assetId, cause })
            );
            return [assetId, `data:image/jpeg;base64,${bytes.toString("base64")}`] as const;
          }).pipe(
            withTimeoutAndRetry("process image", { timeoutMs: 8000, maxRetries: 1 }),
            Effect.catchTag("PdfImageProcessingError", () => Effect.succeed([assetId, null] as const)),
            Effect.catchTag("PdfTimeoutError", () => Effect.succeed([assetId, null] as const))
          ),
        { concurrency: 4 }
      ))
        if (url !== null) resolvedImageUrls[id] = url;
    const pdfBuffer = yield* tryAsync(
      () =>
        renderPlaneDocToPdfBuffer(content.contentJSON, {
          ...input,
          title: input.title || content.titleHTML || undefined,
          metadata: { userMentions, resolvedImageUrls },
        }),
      (cause) => new PdfGenerationError({ message: "Failed to generate PDF.", cause })
    ).pipe(withTimeoutAndRetry("render PDF", { timeoutMs: 15000, maxRetries: 0 }));
    const current = yield* tryAsync(
      async () => {
        if (!(await client.query(api.identity.session.status, {})).valid)
          throw new PdfAuthenticationError({ message: "Authentication required." });
        return client.query(api.documents.index.resolve, {
          workspaceId: page.workspaceId,
          projectId,
          documentId: input.pageId,
        });
      },
      (cause) =>
        Schema.is(PdfExportError)(cause)
          ? cause
          : cause instanceof ConvexError
            ? new PdfAccessError({ message: "Page access denied." })
            : new PdfContentFetchError({ message: "Page access could not be verified.", cause })
    ).pipe(withTimeoutAndRetry("verify page access", { timeoutMs: 7000, maxRetries: 0 }));
    if (!current) return yield* Effect.fail(new PdfNotFoundError({ message: "Page not found." }));
    return { pdfBuffer, outputFileName: input.fileName || `page-${input.pageId}.pdf`, pageId: input.pageId };
  });
