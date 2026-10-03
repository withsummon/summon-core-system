# Task images and intake checkpoint

Source checkpoint `1313b7fc28` includes task-bound image UI (`314f36687d`, pending-operation correction `844dcdc104`) and intake backend/UI (`1003b4a5d9`, `1313b7fc28`). The exact backend archive `1003b4a5d9` was activated locally; this does not claim remote activation.

Primary independently ran the installed test executables: 609 backend tests across 99 files, 40 live-server tests across 3 files, and 55 frontend tests passed. Native TypeScript checks passed for backend and web. `tools/check-toolchain.mjs` confirmed native TypeScript 7.0.2 and Oxc policy across 22 manifests. Logs are `/tmp/summon-migration-control/checkpoint-inline-intake-{backend,live,web}.txt`.

The top-level `pnpm test` command stopped at the dependency verification preflight because the preserved, unrelated editor manifest overlay does not match its lockfile. No installation or manifest/lockfile rewrite was performed to conceal that condition. Direct installed executables ran the same three test scripts; this is test evidence, not a successful frozen install of the dirty checkout.

Owner review traced canonical content-version concurrency, task-bound ready image authorization, non-destructive reference removal, and shared authenticated transfers. Independent backend review found no blocking issue. Primary frontend review caught colliding duplicate-operation status keys and submission during pending transfers; the correction uses independent operation keys and guards at the form submit owner. Intake drafts now survive pending editor recreation through their current HTML value.

## Fixed artifact and Chrome acceptance

Primary fetched HTTP200 `/core` and `/build-identity.json` from `http://127.0.0.1:3030`. The source is `1313b7fc287ecabced37fa1b1a8e7f87a5618768`, with the preserved dependency overlay `2dff1c4d17cdd96cedae19ddcb4713b1cbb6759b42407c7a83bbd466d35067fd`. The 1,273-file artifact has tree SHA256 `43e22abe5fdf875081cf3d803afbdd645bedfa187e27b90c833919ddbc66f9a8` and served index SHA256 `2186d4a2e3b8d9aa321b2ccb1b1bf76c9728bbe2623991825720f37358213a6a`. Clean frozen-overlay installation, dependency builds, native types and production compilation passed. It uses cloud3210, temporary diagnostic site gateway3218, live1235 and unchanged issuer3211.

Chrome fresh sign-in verified ordinary NSTAR-7 image upload (Save disabled while uploading), decoded 192×192 bytes, and successful content save with original text. Local image removal followed by undo restored decoded bytes; removal followed by Cancel retained the saved image. The original text was restored and the synthetic attachment was moved to recoverable removal, preserving its original text attachment and task properties.

Chrome created NSTAR-9 (`k97411gv2vy2wc22ghsxwe6c0x8f77ps`) with High priority, estimate3, Acceptance label and text. Its separate description upload/save succeeded; metadata priority change to Medium preserved the decoded image and text. Acceptance retained the same task identifier, estimate, label and image in ordinary task detail. The accepted intake bridge and task were then both moved to their recoverable Trash; the final task Trash list showed NSTAR-9. No purge occurred.

This journey exposed a display mismatch: intake rendered the static To do group while ordinary task detail rendered the configured Ready for QA state. The separate `0a1c9bf453` correction reuses the canonical state-list owner; it is not part of the3030 artifact and remains browser-unverified. Constrained-width image acceptance, stale concurrent browser saves and remote activation remain unverified; backend BDD covers their concurrency/authorization contracts. No inherited route retirement or performance improvement is established by these checks.
