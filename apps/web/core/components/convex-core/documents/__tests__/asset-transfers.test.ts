import assert from "node:assert/strict";
import { test } from "node:test";
import { AssetTransfers, uploadedStorageId } from "../asset-transfers.ts";

test("leaving a document aborts pending transfers and invalidates its readable blob URLs", async () => {
  const transfers = new AssetTransfers();
  const url = await transfers.run(async (signal) => transfers.objectUrl(new Blob(["private document bytes"]), signal));
  assert.equal(await (await fetch(url)).text(), "private document bytes");
  const pending = transfers.run(
    (signal) =>
      new Promise<void>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      })
  );
  transfers.dispose();
  await assert.rejects(pending, { name: "AbortError" });
  await assert.rejects(fetch(url));
});

test("a completed read cannot publish a new blob URL after document teardown", async () => {
  const transfers = new AssetTransfers();
  let completeRead!: () => void;
  const responseReady = new Promise<void>((resolve) => {
    completeRead = resolve;
  });
  const pending = transfers.run(async (signal) => {
    await responseReady;
    return transfers.objectUrl(new Blob(["late private bytes"]), signal);
  });
  transfers.dispose();
  completeRead();
  await assert.rejects(pending, { name: "AbortError" });
});

test("cancel stops the current upload but a fresh retry can own a new transfer", async () => {
  const transfers = new AssetTransfers();
  transfers.cancel();
  const url = await transfers.run(async (signal) => transfers.objectUrl(new Blob(["retry"]), signal));
  assert.equal(await (await fetch(url)).text(), "retry");
  transfers.dispose();
});

test("upload response requires a successful string storage reference before finalization", async () => {
  assert.equal(await uploadedStorageId(Response.json({ storageId: "server-issued-id" })), "server-issued-id");
  await assert.rejects(uploadedStorageId(Response.json({ storageId: 42 })));
  await assert.rejects(uploadedStorageId(Response.json({ error: "rejected" }, { status: 403 })));
});
