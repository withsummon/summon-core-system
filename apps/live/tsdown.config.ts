import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/start.ts", "src/convex-start.ts"],
  outDir: "dist",
  format: ["esm"],
  deps: { alwaysBundle: ["@summon/convex/api"] },
  dts: false,
  clean: true,
  sourcemap: false,
  exports: false,
});
