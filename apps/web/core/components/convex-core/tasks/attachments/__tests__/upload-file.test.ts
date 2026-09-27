import assert from "node:assert/strict";
import test from "node:test";
import { attachmentContentType } from "../upload-file.ts";
const policy: Parameters<typeof attachmentContentType>[1] = {
  typesByExtension: {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".csv": "text/csv",
  },
  supportedTypes: [
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "text/markdown",
    "text/csv",
  ],
  imageMaxBytes: 5 * 1024 * 1024,
  maxBytes: 10 * 1024 * 1024,
};
test("browser-unknown Markdown uses the published extension policy, but an explicit unsupported MIME is rejected", () => {
  assert.equal(attachmentContentType({ name: "NOTES.MD", type: "", size: 12 }, policy), "text/markdown");
  assert.throws(
    () => attachmentContentType({ name: "NOTES.MD", type: "application/octet-stream", size: 12 }, policy),
    /supported/
  );
  assert.throws(() => attachmentContentType({ name: "unknown.zip", type: "", size: 12 }, policy), /supported/);
});
test("validation uses the policy image limit separately and rejects empty bytes before preparing an upload", () => {
  assert.throws(
    () => attachmentContentType({ name: "photo.png", type: "image/png", size: policy.imageMaxBytes + 1 }, policy),
    /5 MB/
  );
  assert.equal(
    attachmentContentType({ name: "notes.txt", type: "text/plain", size: policy.imageMaxBytes + 1 }, policy),
    "text/plain"
  );
  assert.throws(() => attachmentContentType({ name: "empty.txt", type: "text/plain", size: 0 }, policy), /nonempty/);
});
