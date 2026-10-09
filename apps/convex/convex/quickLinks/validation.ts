import { ConvexError } from "convex/values";
import { text } from "../commercial/validation";
export function linkTitle(value: string | null) {
  return value === null ? null : text(value, "Title", 255);
}
// Host grammar follows the legacy Django URLValidator; browser URL parsing alone
// accepts shortened IPs and invalid DNS labels, and canonicalizes stored spelling.
const ipv4Part = "(?:0|25[0-5]|2[0-4][0-9]|1[0-9]?[0-9]?|[1-9][0-9]?)";
const hostname = "[a-z\\u00a1-\\uffff0-9](?:[a-z\\u00a1-\\uffff0-9-]{0,61}[a-z\\u00a1-\\uffff0-9])?";
const domain = "(?:\\.(?!-)[a-z\\u00a1-\\uffff0-9-]{1,63}(?<!-))*";
const tld = "\\.(?!-)(?:[a-z\\u00a1-\\uffff-]{2,63}|xn--[a-z0-9]{1,59})(?<!-)\\.?";
const urlPattern = new RegExp(
  `^https?://(?:[^\\s:@/]+(?::[^\\s:@/]*)?@)?(?<host>${ipv4Part}(?:\\.${ipv4Part}){3}|\\[[0-9a-f:.]+\\]|${hostname}${domain}${tld}|localhost)(?::[0-9]{1,5})?(?:[/?#][^\\s]*)?$`,
  "i"
);
export function linkUrl(value: string, options?: { requireScheme: true }) {
  if (options?.requireScheme && !value.startsWith("http://") && !value.startsWith("https://"))
    throw new ConvexError("URL must start with http:// or https://");
  // Scheme fill occurs before whitespace trimming, as in the legacy serializer.
  const url = (value.startsWith("http://") || value.startsWith("https://") ? value : `http://${value}`).trim();
  const host = urlPattern.exec(url)?.groups?.host;
  if (url.length > 2048 || !host || host.length > 253)
    throw new ConvexError("Enter a valid HTTP or HTTPS URL up to 2048 characters.");
  if (host.startsWith("[")) {
    try {
      void new URL(`http://${host}`);
    } catch {
      throw new ConvexError("Enter a valid IPv6 URL.");
    }
  }
  return url;
}
function jsonValue(value: unknown): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(jsonValue);
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Object.values(value).every(jsonValue);
}
export function linkMetadata(value: unknown) {
  if (value === null || !jsonValue(value)) throw new ConvexError("Metadata must be a non-null JSON value.");
  return value;
}
