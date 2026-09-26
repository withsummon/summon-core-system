# Native TypeScript and Oxc migration

Control artifact: 05f894b84bbde4e2474b82f17be7f4578bc15f14, with preexisting editor/UI dependency edits preserved separately in `/tmp/summon-migration-control/preexisting.patch`.

## Decision and owners

All workspace type checks and declaration builds use catalog-pinned `typescript@7.0.2`. This stable distribution runs the Go compiler under the command `tsc`; `pnpm tsgo` forwards to that same command. No native-preview or TypeScript 5 fallback is installed for checking.

The catalog and pnpm override own the version. `tools/check-toolchain.mjs` verifies the installed native distribution, every workspace compiler resolution, catalog declarations, and Oxlint/Oxfmt check coverage. Root checks and the typecheck CI job invoke it. The Python API/proxy packages remain excluded from the JavaScript workspace, as declared in `pnpm-workspace.yaml`.

Oxlint/Oxfmt were already installed in the control. This slice completes their workspace coverage for codemods, codex-bridge, Tailwind config, and TypeScript config; adds root tooling/configuration checks; moves ignore rules from the obsolete `.prettierignore` into Oxfmt; and applies the formatter to files rejected by the expanded checks. Existing lint warning budgets remain visible, rather than presenting migration as removal of every existing warning. Generated i18n keys are excluded from formatting because their generator owns them.

## Compatibility changes

1. tsdown 0.16 called the removed JavaScript compiler API (`ts.sys.useCaseSensitiveFileNames`) and failed declaration generation. tsdown 0.23 detects TypeScript 7 and emits with the native compiler. Express remains external in logger/decorators declaration bundles because the CommonJS Express declarations cannot be bundled as ESM. Generated `inlinedDependencies` no longer claims those types are bundled.
2. Browser applications explicitly load the shared declarations for four CSS-only package entry points; i18n explicitly includes the Node types it uses. No strictness setting was weakened.
3. The report behavior test now imports its actual source using Node type stripping instead of `transpileModule`, a removed compiler API. It lives in the report module's `__tests__` directory. `allowImportingTsExtensions` enables this existing Node test pattern, and two now-unnecessary suppression comments were removed.
4. The editor AI popup resolves its actual frame before passing it to Tippy, removing an invalid nullable append target and a stale suppression. Codemods now receive filenames through the library's documented `FileInfo` input rather than an ignored options field; their formerly uncovered typecheck is enabled.
5. Oxfmt preserves the field order of generated package manifests, avoiding a formatting fight with tsdown. Other formatting is mechanical; no domain behavior was intentionally changed by it.

## Verification

| Check                                                    | Result                                                                        |
| -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `node tools/check-toolchain.mjs`                         | Passed; native 7.0.2 resolved across the discovered workspace manifests       |
| `pnpm turbo run check:types --filter='!@summon/convex'`  | 29/29 tasks passed, including required declaration builds                     |
| `pnpm build` before the new Convex package was added     | 16/16 tasks passed: library builds and web/admin/space/live production builds |
| `pnpm turbo run check:lint --filter='!@summon/convex'`   | 20/20 passed under the existing warning budgets                               |
| `pnpm turbo run check:format --filter='!@summon/convex'` | 20/20 passed                                                                  |
| Root Oxfmt configuration/tooling/GitHub check            | Passed on 21 files                                                            |
| Codemod behavior suite                                   | 33/33 tests passed                                                            |
| Report module existing Node suite                        | 5/5 tests passed                                                              |

The Convex slice was being authored concurrently and is deliberately excluded from the final toolchain-only checks above. Its owner must run the unfiltered gates after its generated API and implementation are complete. Build success proves compiler/bundler compatibility, not browser workflow parity. Editor popup visual behavior still belongs to browser QA.

Raw logs are under `/tmp/summon-migration-control/`: `types7-toolchain.txt`, `build7-final.txt`, `lint7-toolchain.txt`, `format7-toolchain.txt`, `codemods-test.txt`, and `complexity-toolchain.json`. These are local execution receipts, not durable production performance evidence.

## Review receipt

Owner: catalog/compiler distribution, tsdown declaration generator, shared browser asset declarations, and package check scripts.

Invariant: one native compiler; every existing strictness check preserved; generated package declarations remain consumable; no legacy compiler API hidden behind a fallback.

Deletion: obsolete formatter ignore file, runtime test transpilation/data-URL cast, four stale suppression comments, and inaccurate bundled Express-type metadata.

Complexity: the edited AI menu's highest function remains 7; its setup effect changes from 2 to 3 because the required frame is resolved before invoking Tippy. The codemod owner remains unchanged at a preexisting maximum of 16; the only production edit there removes an unused suppression. New toolchain helper complexity is 1. Cognitive verdict: clear for the changed owners; no extracted control-flow wrappers or test-only seams were introduced.

Performance claim: none. Compiler/build wall times were collected during concurrent migration work without equivalent repeated controls; they must not be presented as a TypeScript speedup or a Django-versus-Convex result.

Sources: [TypeScript native command transition](https://github.com/microsoft/typescript-go), [native declaration generator selection](https://github.com/sxzz/rolldown-plugin-dts/blob/main/src/options.ts), [Oxfmt ignore rules](https://oxc.rs/docs/guide/usage/formatter/ignore-files.html). Installed package exports/types and complete production builds were used to verify compatibility.
