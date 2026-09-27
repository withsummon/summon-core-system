# Preserved UI local checkpoint

Source: `2d2374e776307bb168d34a33d284869b2effb4a4`. The primary deployed this exact Git archive to **local** Convex `http://127.0.0.1:3210` on 2026-09-27, with that full commit as the deployment audit message. No remote deployment, public route switch, Django shutdown or Postgres retirement occurred.

## Artifact and verification

The archive is `/tmp/summon-convex-deploy-2d2374e776`. It contains committed backend/editor source and links existing installed dependencies. Editor source/configuration was proved unchanged from the earlier `80c4b8a6e0` archive before reusing that archive's editor build. The unrelated working-tree dependency overlay was not committed or represented as a clean dependency installation. Archive native TypeScript passed; its complete backend suite passed **639 tests in108 files**. The updated routine web test selection passed **65 behaviors** from the corresponding checkout.

The first archive preparation failed because the host Python lacks the newer tar extraction filter parameter; the empty destination was verified before retrying with explicit path/link validation. The first archive typecheck failed on the package-manager shim's relative dependency path; adding the archive's dependency-root symlink resolved it. Neither failed preparation was deployed. The successful deployment reported schema validation, finalization and no deleted indexes. Log: `/tmp/summon-migration-control/preserved-ui-2d2374e776-local-deploy.txt`.

## Local additive backfills

| Owner | First complete scan | Second complete scan |
| --- | --- | --- |
| Project lifecycle |12 processed,12 changed |12 processed,0 changed |
| Project features |12 processed,12 changed |12 processed,0 changed |
| Workspace lifecycle |14 processed,14 changed |14 processed,0 changed |

Each scan completed in one bounded cursor page. Evidence: `/tmp/summon-migration-control/preserved-ui-2d2374e776-local-backfills.json`. Remote scans remain outstanding, so optional migration fields and backfill functions remain. The checkpoint also activates the previously committed cycle completion curves and task-description content-token cleanup locally; their separate browser/remote boundaries remain as documented.

## Runtime evidence

The deployed availability query returned passwordSignIn=true, magicCode=false, passwordReset=false and emailVerification=false, matching the unchanged local operator/mail configuration. Chrome `http://localhost:3021/core` rendered the password form, accepted the existing synthetic QA account, and loaded Northstar Delivery through authenticated live queries. No account, credential or email configuration was changed. This development QA surface is not production UI parity and has no frozen frontend build identity.

Separately, the preserved deployed presentation was exercised at `http://localhost:3010/summon-local-qa-20260926/summon/tasks/` against **Django8000**. Task creation, deep-link detail, description save/reload/failure/recovery, narrow task detail and workspace-menu/command-palette navigation are recorded in `production-description-autosave.md` and `production-bootstrap-owner-map.md`. These two runtime owners remain distinct; their evidence cannot be combined into a claim that the preserved production UI is already Convex-backed.

## Remaining cutover boundaries

The authenticated production shell and its commands still require actual native ownership integration. Workspace deletion's retained slug/profile-pointer policy differs from inherited deletion and remains an explicit parity gap. Remote upload/runner authorization and real mail configuration remain pending. No equivalent preserved-UI benchmark or full-product speedup is claimed.
