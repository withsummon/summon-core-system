import { ConvexError } from "convex/values";

export const assetTypesByExtension = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
} as const;
export const supportedAssetTypes = [...new Set(Object.values(assetTypesByExtension))];
export const assetSizeLimit = (contentType: string) =>
  contentType.startsWith("image/") ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
export function validateIntent(name: string, contentType: string, size: number, sha256: string) {
  if (
    !name.trim() ||
    name.length > 255 ||
    name.includes("/") ||
    name.includes("\\") ||
    [...name].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  )
    throw new ConvexError("Enter a filename without path separators or control characters.");
  if (!supportedAssetTypes.some((type) => type === contentType))
    throw new ConvexError("This content type is not supported.");
  const limit = assetSizeLimit(contentType);
  if (!Number.isSafeInteger(size) || size < 1 || size > limit)
    throw new ConvexError("File size exceeds the supported limit.");
  if (!/^[A-Za-z0-9+/]{43}=$/.test(sha256)) throw new ConvexError("Provide a base64 SHA-256 digest of the file.");
}
// Format signatures reject MIME spoofing at this boundary. This is not malware
// scanning or full parser validation; documents are served as attachments.
export async function validateContent(blob: Blob, contentType: string) {
  if (blob.type.split(";")[0]?.trim().toLowerCase() !== contentType)
    throw new ConvexError("Uploaded content type does not match the request.");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const prefix = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  const ascii = (start: number, end: number) => new TextDecoder().decode(bytes.slice(start, end));
  const signatures: Record<string, () => boolean> = {
    "image/png": () => prefix(137, 80, 78, 71, 13, 10, 26, 10),
    "image/jpeg": () => prefix(255, 216, 255),
    "image/gif": () => ["GIF87a", "GIF89a"].includes(ascii(0, 6)),
    "image/webp": () => ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP",
    "application/pdf": () => ascii(0, 5) === "%PDF-",
  };
  if (contentType.startsWith("text/")) {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (text.includes("\0")) throw new Error("Binary text");
    } catch {
      throw new ConvexError("Text files must contain valid UTF-8 text.");
    }
  } else if (!signatures[contentType]?.()) throw new ConvexError("File content does not match its declared type.");
}
