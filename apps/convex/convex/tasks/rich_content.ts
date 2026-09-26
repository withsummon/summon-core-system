import sanitizeHtml from "sanitize-html";
import { ConvexError } from "convex/values";

const safeColor = /^(?:#[a-f0-9]{3,8}|[a-z][a-z-]*|(?:rgb|hsl)a?\([0-9.,%\s]+\)|var\(--[a-z0-9-]+\))$/i;
const blockTags = new Set(["p", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "tr", "br"]);
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
  if (input.length > 100000) throw new ConvexError("Task description must be at most 100,000 characters.");
  const html = sanitizeHtml(input, {
    allowedTags: sanitizeHtml.defaults.allowedTags,
    allowedAttributes: {
      "*": ["style"],
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
      span: (tagName, attributes) => {
        const attribs = { ...attributes };
        for (const key of ["data-text-color", "data-background-color"]) {
          if (attribs[key] && !safeColor.test(attribs[key])) delete attribs[key];
        }
        return { tagName, attribs };
      },
    },
  });
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
  return { html, description: description.trim() };
}
