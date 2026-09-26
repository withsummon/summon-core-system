import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

// The catalog and override select one compiler for CLI checks and declaration builds.
const root = resolve(import.meta.dirname, "..");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const rootRequire = createRequire(resolve(root, "package.json"));
const compiler = rootRequire("typescript/package.json");
assert.match(compiler.version, /^7\./, "Type checks require native TypeScript 7");
assert.ok(
  compiler.optionalDependencies["@typescript/typescript-linux-x64"],
  "Expected the native compiler distribution"
);

const manifests = [resolve(root, "package.json")];
for (const directory of ["apps", "packages"]) {
  for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) {
    const path = resolve(root, directory, entry.name, "package.json");
    if (entry.isDirectory() && !["api", "proxy"].includes(entry.name) && existsSync(path)) manifests.push(path);
  }
}

for (const path of manifests) {
  const manifest = readJson(path);
  const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
  assert.ok(!dependencies.eslint && !dependencies.prettier, `${manifest.name}: use Oxlint and Oxfmt`);
  if (dependencies.typescript) {
    assert.equal(dependencies.typescript, "catalog:", `${manifest.name}: TypeScript must use the catalog`);
    assert.equal(
      createRequire(path)("typescript/package.json").version,
      compiler.version,
      `${manifest.name}: compiler drift`
    );
  }
  if (path !== manifests[0]) {
    assert.match(manifest.scripts?.["check:lint"] ?? "", /^oxlint\b/, `${manifest.name}: missing Oxlint check`);
    assert.match(manifest.scripts?.["check:format"] ?? "", /^oxfmt\b/, `${manifest.name}: missing Oxfmt check`);
    if (existsSync(resolve(path, "..", "tsconfig.json"))) {
      assert.match(manifest.scripts?.["check:types"] ?? "", /\btsc\b/, `${manifest.name}: missing native type check`);
    }
  }
}

const executable = resolve(rootRequire.resolve("typescript/package.json"), "..", compiler.bin.tsc);
const version = execFileSync(process.execPath, [executable, "--version"], { encoding: "utf8" }).trim();
assert.equal(version, `Version ${compiler.version}`);
console.log(`${version}: native compiler and Oxc policy verified for ${manifests.length} manifests.`);
