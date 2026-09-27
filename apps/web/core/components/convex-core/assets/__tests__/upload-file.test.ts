import assert from "node:assert/strict";
import { test } from "node:test";
import type { Id } from "@summon/convex/data-model";
import { uploadFileAsset } from "../upload-file.ts";
const policy: Parameters<typeof uploadFileAsset>[1] = {
  supportedTypes: ["image/png"],
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
  imageMaxBytes: 1024,
  maxBytes: 2048,
};
const assetId = "synthetic-asset" as Id<"assets">;
test("shared upload resolves empty browser MIME, transfers matching bytes and finalizes only canonical storage receipt", async (t) => {
  const file = new File([new Uint8Array([137, 80, 78, 71])], "photo.png");
  const prepared: unknown[] = [];
  const finalized: unknown[] = [];
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    assert.equal(new Headers(init.headers).get("Content-Type"), "image/png");
    assert.ok(init.body instanceof Blob);
    assert.equal(init.body.type, "image/png");
    assert.deepEqual(new Uint8Array(await init.body.arrayBuffer()), new Uint8Array(await file.arrayBuffer()));
    return Response.json({ storageId: "storage-receipt" });
  });
  const result = await uploadFileAsset(
    file,
    policy,
    async (metadata) => {
      prepared.push(metadata);
      return { assetId, uploadUrl: "https://upload.invalid/ticket" };
    },
    async (args) => {
      finalized.push(args);
      return assetId;
    },
    new AbortController().signal
  );
  assert.equal(result, assetId);
  assert.equal(prepared.length, 1);
  assert.deepEqual(finalized, [{ assetId, storageId: "storage-receipt" }]);
});
test("cancel after ticket creation prevents byte upload and finalization; invalid type never prepares", async (t) => {
  let requests = 0,
    finalizations = 0,
    preparations = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests++;
    return Response.json({ storageId: "unused" });
  });
  const abort = new AbortController();
  const prepare: Parameters<typeof uploadFileAsset>[2] = async () => {
    preparations++;
    abort.abort();
    return { assetId, uploadUrl: "https://upload.invalid/ticket" };
  };
  const finalize: Parameters<typeof uploadFileAsset>[3] = async () => {
    finalizations++;
    return assetId;
  };
  await assert.rejects(uploadFileAsset(new File(["bytes"], "photo.png"), policy, prepare, finalize, abort.signal), {
    name: "AbortError",
  });
  await assert.rejects(
    uploadFileAsset(new File(["bytes"], "file.exe"), policy, prepare, finalize, new AbortController().signal),
    /supported/
  );
  assert.equal(preparations, 1);
  assert.equal(requests, 0);
  assert.equal(finalizations, 0);
});
