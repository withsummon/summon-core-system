import { ECustomImageAttributeNames, ECustomImageStatus } from "@plane/editor/image-contract";
import sanitizeHtml from "sanitize-html";
import { ConvexError } from "convex/values";

const safeColor = /^(?:#[a-f0-9]{3,8}|[a-z][a-z-]*|(?:rgb|hsl)a?\([0-9.,%\s]+\)|var\(--[a-z0-9-]+\))$/i;
const blockTags = new Set(["p", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "tr", "br"]);
const imageHtmlLimit = 640 * 1024;
export function plainDescriptionHtml(text: string) {
  const escaped = text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
  return escaped
    .split("\n")
    .map((line) => `<p>${line}</p>`)
    .join("");
}
export function taskRichContent(input: string) {
  return sanitizeRichContent(input, false);
}

/** Description and comment owners must bind these image IDs before persisting this content. */
export function imageRichContent(input: string) {
  const content = sanitizeRichContent(input, true);
  return { ...content, sources: uploadedImageSources(content.html) };
}

/** Shared node parser also reads already-sanitized stored content without reapplying the raw input budget. */
export function uploadedImageSources(html: string) {
  const sources = new Set<string>();
  sanitizeHtml(html, {
    allowedTags: ["image-component"],
    allowedAttributes: { "image-component": ["src", "status"] },
    exclusiveFilter: (frame) => {
      if (frame.tag === "image-component") {
        if (!frame.attribs.src || frame.attribs.status !== ECustomImageStatus.UPLOADED)
          throw new ConvexError("Finish uploading images before saving.");
        sources.add(frame.attribs.src);
      }
      return false;
    },
  });
  if (sources.size > 100) throw new ConvexError("Content can reference at most 100 distinct images.");
  return sources;
}

function sanitizeRichContent(input: string, images: boolean) {
  const inputLimit = images ? imageHtmlLimit : 100000;
  if (input.length > inputLimit) throw new ConvexError(`Rich content must be at most ${inputLimit} HTML characters.`);
  const html = sanitizeHtml(input, {
    allowedTags: images ? [...sanitizeHtml.defaults.allowedTags, "image-component"] : sanitizeHtml.defaults.allowedTags,
    allowedAttributes: {
      "*": ["style"],
      ...(images
        ? {
            "image-component": [
              ...Object.values(ECustomImageAttributeNames).map((name) => name.toLowerCase()),
              "alt",
              "title",
            ],
          }
        : {}),
      span: ["data-text-color", "data-background-color"],
      a: ["href", "title"],
      ol: ["start", "data-type"],
      ul: ["data-type"],
      li: ["data-type", "data-checked"],
      td: ["colspan", "rowspan", "colwidth"],
      th: ["colspan", "rowspan", "colwidth"],
      code: ["class"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    allowedStyles: {
      "*": { color: [safeColor], "background-color": [safeColor], "text-align": [/^(?:left|right|center|justify)$/] },
    },
    transformTags: {
      img: (tagName, attribs) => {
        if (images) throw new ConvexError("Description images must use uploaded work item image nodes.");
        return { tagName, attribs };
      },
      span: (tagName, attributes) => {
        const attribs = { ...attributes };
        for (const key of ["data-text-color", "data-background-color"]) {
          if (attribs[key] && !safeColor.test(attribs[key])) delete attribs[key];
        }
        return { tagName, attribs };
      },
    },
  });
  if (images && new TextEncoder().encode(html).byteLength > imageHtmlLimit)
    throw new ConvexError(`Formatted content must be at most ${imageHtmlLimit} bytes.`);
  // The existing sanitizer/parser owns tag removal and entity decoding. Preserve
  // block boundaries for list/search consumers without regex-based HTML parsing.
  const chunks: string[] = [];
  sanitizeHtml(html, {
    allowedTags: [],
    textFilter: (text) => {
      chunks.push(text);
      return text;
    },
    onCloseTag: (tag) => {
      if (blockTags.has(tag)) chunks.push("\n");
    },
  });
  let description = "";
  sanitizeHtml(`<div>${chunks.join("")}</div>`, {
    allowedTags: ["div"],
    exclusiveFilter: (frame) => {
      description = frame.text;
      return false;
    },
  });
  description = description.trim();
  if (images && description.length > 100000) throw new ConvexError("Text must be at most 100,000 characters.");
  return { html, description };
}
