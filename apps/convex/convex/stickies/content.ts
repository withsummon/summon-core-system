import { ConvexError } from "convex/values";
import { taskRichContent } from "../tasks/rich_content";
export function stickyString(value: string | null, label: string, max: number) {
  if (value !== null && value.length > max) throw new ConvexError(`${label} must be at most ${max} characters.`);
  return value;
}
export function stickyContent(html: string) {
  const content = taskRichContent(html);
  return { html: content.html, description: content.description };
}
export function stickyBinary(value: ArrayBuffer | null) {
  if (value !== null && value.byteLength > 524288) throw new ConvexError("Sticky binary must be at most 512 KiB.");
  return value;
}
export function stickyOrder(value: number) {
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)
    throw new ConvexError("Sticky order must be a finite value within the supported range.");
  return value;
}
