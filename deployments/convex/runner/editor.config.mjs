import { defineConfig } from "tsdown";

// Build the existing server entrypoint consumed by Convex; no browser UI bundle.
export default defineConfig({
  entry: ["src/lib.ts"],
  format: ["esm"],
  platform: "node",
  dts: true,
  fixedExtension: false,
  exports: false,
});
