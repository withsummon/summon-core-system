import assert from "node:assert/strict";
import { test } from "node:test";
import { AssetLifecycle } from "../asset-lifecycle.ts";

test("immediate image delete then undo finishes restoration before resolving its source", async () => {
  const lifecycle = new AssetLifecycle();
  const events: string[] = [];
  let completeDelete!: () => void;
  const deletionReady = new Promise<void>((resolve) => {
    completeDelete = resolve;
  });
  const deletion = lifecycle.run("asset", async () => {
    events.push("delete started");
    await deletionReady;
    events.push("deleted");
  });
  const restoration = lifecycle.run("asset", async () => {
    events.push("restored");
  });
  const source = (async () => {
    await lifecycle.wait("asset");
    events.push("read source");
  })();
  await Promise.resolve();
  assert.deepEqual(events, ["delete started"]);
  completeDelete();
  await Promise.all([deletion, restoration, source]);
  assert.deepEqual(events, ["delete started", "deleted", "restored", "read source"]);
});

test("failed deletion reports its error while explicit undo can recheck the server", async () => {
  const lifecycle = new AssetLifecycle();
  const deletion = lifecycle.run("asset", async () => {
    throw new Error("Write access changed");
  });
  const restoration = lifecycle.run("asset", async () => "restored after reauthorization");
  await assert.rejects(deletion, /Write access changed/);
  assert.equal(await restoration, "restored after reauthorization");
  await lifecycle.wait("asset");
});

test("one pending asset mutation does not block another image", async () => {
  const lifecycle = new AssetLifecycle();
  let finish!: () => void;
  const waiting = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const blocked = lifecycle.run("one", () => waiting);
  assert.equal(await lifecycle.run("two", async () => "independent"), "independent");
  finish();
  await blocked;
});
