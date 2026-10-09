/** Portable image bytes contain no session credentials or temporary source URL. */
export async function embeddedImage(blob: Blob, signal: AbortSignal) {
  if (!blob.type.startsWith("image/")) throw new Error("The document image is not an image file.");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  signal.throwIfAborted();
  let binary = "";
  for (let start = 0; start < bytes.length; start += 8192)
    binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
  return `data:${blob.type};base64,${btoa(binary)}`;
}
