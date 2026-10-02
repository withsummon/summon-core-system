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
export const meetingRecordingTypes = [
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
] as const;
export const meetingRecordingMaxBytes = 250 * 1024 * 1024;
// Private HTTP actions have a 20 MiB response limit; recordings use bounded authenticated ranges.
export const recordingReadMaxBytes = 8 * 1024 * 1024;
export const assetSizeLimit = (contentType: string) =>
  contentType.startsWith("image/") ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
export function validateIntent(
  name: string,
  contentType: string,
  size: number,
  sha256: string,
  meetingRecording = false
) {
  if (
    !name.trim() ||
    name.length > 255 ||
    name.includes("/") ||
    name.includes("\\") ||
    [...name].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  )
    throw new ConvexError("Enter a filename without path separators or control characters.");
  const supportedTypes = meetingRecording ? meetingRecordingTypes : supportedAssetTypes;
  if (!supportedTypes.some((type) => type === contentType))
    throw new ConvexError("This content type is not supported.");
  const limit = meetingRecording ? meetingRecordingMaxBytes : assetSizeLimit(contentType);
  if (!Number.isSafeInteger(size) || size < 1 || size > limit)
    throw new ConvexError("File size exceeds the supported limit.");
  if (!/^[A-Za-z0-9+/]{43}=$/.test(sha256)) throw new ConvexError("Provide a base64 SHA-256 digest of the file.");
}
// Format signatures reject MIME spoofing at this boundary. This is not malware
// scanning or full parser validation; documents are served as attachments.
export async function validateContent(blob: Blob, contentType: string, meetingRecording = false) {
  if (blob.type.split(";")[0]?.trim().toLowerCase() !== contentType)
    throw new ConvexError("Uploaded content type does not match the request.");
  // Binary formats only need a bounded prefix. Recording bytes can be 250 MiB;
  // their storage metadata already owns the complete-file size and SHA-256 proof.
  const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const prefix = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  const ascii = (start: number, end: number) => new TextDecoder().decode(bytes.slice(start, end));
  if (meetingRecording) {
    const recordings = {
      "audio/mpeg": () =>
        ascii(0, 3) === "ID3" ||
        (bytes.length >= 2 && bytes[0] === 255 && (bytes[1] & 224) === 224 && (bytes[1] & 6) !== 0),
      "audio/mp4": () => ascii(4, 8) === "ftyp",
      "audio/x-m4a": () => ascii(4, 8) === "ftyp",
      "audio/wav": () => ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE",
      "audio/x-wav": () => ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE",
      "audio/webm": () => prefix(26, 69, 223, 163),
      "audio/ogg": () => ascii(0, 4) === "OggS",
    } satisfies Record<(typeof meetingRecordingTypes)[number], () => boolean>;
    const type = meetingRecordingTypes.find((supportedType) => supportedType === contentType);
    if (!type || !recordings[type]()) throw new ConvexError("Recording content does not match its declared type.");
    return;
  }
  const signatures: Record<string, () => boolean> = {
    "image/png": () => prefix(137, 80, 78, 71, 13, 10, 26, 10),
    "image/jpeg": () => prefix(255, 216, 255),
    "image/gif": () => ["GIF87a", "GIF89a"].includes(ascii(0, 6)),
    "image/webp": () => ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP",
    "application/pdf": () => ascii(0, 5) === "%PDF-",
  };
  if (contentType.startsWith("text/")) {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(await blob.arrayBuffer());
      if (text.includes("\0")) throw new Error("Binary text");
    } catch {
      throw new ConvexError("Text files must contain valid UTF-8 text.");
    }
  } else if (!signatures[contentType]?.()) throw new ConvexError("File content does not match its declared type.");
}

export function externalCoverUrl(value: string | null) {
  if (value === null) return undefined;
  if (!value || value.length > 2048 || value !== value.trim())
    throw new ConvexError("Enter an external cover URL of at most 2048 characters.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ConvexError("Enter a valid external cover URL.");
  }
  if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password)
    throw new ConvexError("Use an http or https cover URL without credentials.");
  return value;
}
