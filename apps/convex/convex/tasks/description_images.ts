import { ECustomImageStatus } from "@plane/editor/image-contract";
import sanitizeHtml from "sanitize-html";
import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireAsset } from "../assets/access";
import { taskDescriptionImageContent } from "./rich_content";

/** Explicit task-description boundary; shared comment/intake sanitizers still omit images. */
export async function boundDescriptionContent(
  ctx: QueryCtx,
  scope: Id<"tasks"> | { draftId: Id<"taskDrafts"> },
  html: string
) {
  const content = taskDescriptionImageContent(html);
  const sources = new Set<string>();
  sanitizeHtml(content.html, {
    allowedTags: ["image-component"],
    exclusiveFilter: (frame) => {
      if (frame.tag === "image-component") {
        if (!frame.attribs.src || frame.attribs.status !== ECustomImageStatus.UPLOADED)
          throw new ConvexError("Finish uploading images before saving the description.");
        sources.add(frame.attribs.src);
      }
      return false;
    },
    allowedAttributes: { "image-component": ["src", "status"] },
  });
  // Bounds authorization/storage reads in the same atomic save; no silent truncation.
  if (sources.size > 100) throw new ConvexError("A description can reference at most 100 distinct images.");
  const assets = await Promise.all(
    [...sources].map(async (source) => {
      const id = ctx.db.normalizeId("assets", source);
      if (!id) throw new ConvexError("Description images must be uploaded to this work item.");
      const { asset } = await requireAsset(ctx, id);
      const bound = typeof scope === "string" ? asset.taskId === scope : asset.draftId === scope.draftId;
      if (!bound || !asset.contentType.startsWith("image/"))
        throw new ConvexError("Description image belongs to another work item or is not an image.");
      return asset;
    })
  );
  // Removing a node unlinks its reference only. Attachment bytes remain available
  // to saved history/other references, under the existing explicit attachment lifecycle.
  return { ...content, assets };
}

/** Copied image nodes keep their attributes but reference independent destination assets. */
export function remapDescriptionImages(html: string, sources: ReadonlyMap<string, Id<"assets">>) {
  const content = taskDescriptionImageContent(html);
  const rewritten = sanitizeHtml(content.html, {
    // The canonical sanitizer above already owns the accepted tags and attributes.
    allowedTags: false,
    allowedAttributes: false,
    transformTags: {
      "image-component": (tagName, attributes) => {
        const src = sources.get(attributes.src);
        if (!src) throw new ConvexError("Copied description image is missing.");
        return { tagName, attribs: { ...attributes, src } };
      },
    },
  });
  return { ...content, html: rewritten };
}
