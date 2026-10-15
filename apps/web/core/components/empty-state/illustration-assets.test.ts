import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Writable } from "node:stream";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { ReactNode } from "react";
import { renderToPipeableStream } from "react-dom/server";
import {
  getCompactAsset,
  getDetailedAsset,
  HORIZONTAL_STACK_ASSETS,
  ILLUSTRATION_ASSETS,
  VERTICAL_STACK_ASSETS,
} from "@plane/propel/empty-state";
import type { CompactAssetType, DetailedAssetType } from "@plane/propel/empty-state";

function renderToMarkup(node: ReactNode): Promise<string> {
  return new Promise((resolve, reject) => {
    let html = "";
    const sink = new Writable({
      write(chunk: Buffer, _encoding, done) {
        html += chunk.toString();
        done();
      },
    });
    sink.on("finish", () => resolve(html));
    const stream = renderToPipeableStream(node, {
      onAllReady: () => stream.pipe(sink),
      onError: reject,
    });
  });
}

test("the empty-state entry carries no illustration markup", () => {
  const entry = readFileSync(fileURLToPath(import.meta.resolve("@plane/propel/empty-state")), "utf8");
  assert.equal(entry.includes("viewBox"), false);
});

test("every compact asset key renders its illustration", async () => {
  const keys = [...Object.keys(HORIZONTAL_STACK_ASSETS), ...Object.keys(ILLUSTRATION_ASSETS)] as CompactAssetType[];
  const markup = await Promise.all(keys.map((key) => renderToMarkup(getCompactAsset(key))));
  keys.forEach((key, index) => assert.match(markup[index], /<svg/, key));
});

test("every detailed asset key renders its illustration", async () => {
  const keys = [...Object.keys(VERTICAL_STACK_ASSETS), ...Object.keys(ILLUSTRATION_ASSETS)] as DetailedAssetType[];
  const markup = await Promise.all(keys.map((key) => renderToMarkup(getDetailedAsset(key))));
  keys.forEach((key, index) => assert.match(markup[index], /<svg/, key));
});
