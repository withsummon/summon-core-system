import assert from "node:assert/strict";
import { test } from "node:test";
import { embeddedImage } from "../export-images.ts";

test("authorized image bytes become portable data without a source URL or session token", async () => {
  const bytes = new Uint8Array([137, 80, 78, 71, 0, 255, 128]);
  const embedded = await embeddedImage(new Blob([bytes], { type: "image/png" }), new AbortController().signal);
  assert.equal(embedded, "data:image/png;base64,iVBORwD/gA==");
  assert.deepEqual(Buffer.from(embedded.split(",")[1], "base64"), Buffer.from(bytes));
});

test("non-image attachment bytes cannot be embedded as a document image", async () => {
  await assert.rejects(
    embeddedImage(new Blob(["private attachment"], { type: "text/plain" }), new AbortController().signal),
    /not an image file/
  );
});

test("closing an export aborts image conversion before creating portable output", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(embeddedImage(new Blob(["bytes"], { type: "image/png" }), controller.signal), {
    name: "AbortError",
  });
});
