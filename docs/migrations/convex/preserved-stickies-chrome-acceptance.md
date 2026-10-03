# Preserved Stickies route: Chrome acceptance

## Delivered boundary

Local URL: http://localhost:3031/northstar-convex-qa/stickies/

This is the existing `/:workspaceSlug/stickies/` route, explicitly selected with `SUMMON_STICKIES_ROUTE_OWNER=convex`. It uses the shared production shell, header, note editor/toolbar, search, grid and dialog presentation. Default builds still assign this route to legacy until explicitly configured. Public production was not changed, and Django/Postgres have not been retired.

Frontend artifact: `59920c569155e538ee45c89fd7c9df84c332aa89`.
Local Convex backend: `1a2617389cef84c8043fd764d148924bfcd4070d`, deployed from its committed archive.
Artifact directory: `/tmp/summon-stickies-59920c5691/apps/web/build/client`.
The HTTP response at the deep link exactly matched the built index bytes.

- Index SHA256: `5c07a2c54eb51f7868af20254379c99c06d7517aff55b2bb6c690a119d35994b`
- Sorted bundle manifest SHA256: `a07af3bdbaf12b41cdd59ba496bf1091c2f2c84ae04e375a158795e54eac6454` (1269 files)
- Existing installed dependencies and compiled shared packages were reused. This is a fixed served bundle, not a clean lockfile installation claim. The unrelated dependency overlay remains uncommitted.

## Chrome behavior evidence (2026-09-27)

1. Preserved desktop shell and header render. Production Masonry positions notes in columns; the existing development StrictMode vendor issue does not reproduce in this production bundle. At an actual 768×900 viewport the page uses two columns and the All stickies modal remains usable. Temporary viewport overrides were removed.
2. Header Add sticky and Cmd+K → Create new sticky create real Convex notes. Edits autosave; reload retains text and palette color. Search filters after its debounce and clearing restores notes. Cmd+K, arrow selection and Enter open All stickies. Editing in the dialog updates the page and a second Chrome tab without reload. Opening the final-build dialog emitted zero mutations and zero HTTP requests (complete capture).
3. A physical drag moved the disposable QA note after another note using `stickies/index:move`. A subsequent edit saved successfully, and reload retained both order and content. Delete confirmation Cancel retained the note; confirming Delete removed that disposable note from the live list.
4. Simultaneous edits in two tabs produced a real revision conflict. The losing tab retained its text. Clicking Home opened the unsaved-changes dialog; Stay kept the draft. Explicit Discard loaded the saved peer version. The first pass exposed a server stack in the alert; commit `59920c5691` fixes the actual ConvexError owner, and the final-build rerun shows only “This sticky changed. Reopen it before saving.” with recovery controls.
5. The final route is left open with saved QA notes. All mutations in this acceptance were confined to the existing local synthetic QA workspace/account. Signup, workspace switching, sign-out, uploaded account-cover parity, mobile widths below 768px, and whole-product migration are not claimed by this receipt.

The full create/color/search/drag/delete sequence ran on `1145544e98`; the only subsequent code change was the two-file conflict-message fix. The final `59920c5691` bundle was rechecked for route load, complete network capture, two-tab conflict/recovery, dialog no-op, dialog editing and peer convergence.

## Remaining Django requests

A continuously drained Chrome CDP trace of the final route load contained 187 filtered events with `truncated=false` and no missing buffered pages. Application backend traffic was:

| Context                                 | Observed transport                                                                                  | Result                                              |
| --------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Stickies initial load                   | POST `http://127.0.0.1:3210/api/action`                                                             | Convex authentication action                        |
| Stickies live data                      | `ws://127.0.0.1:3210/api/1.46.0/sync`                                                               | Convex queries/mutations                            |
| Stickies route and own dialogs/commands | No port-8000 request observed                                                                       | No Django runtime dependency in the exercised slice |
| Account menu → Settings                 | GET `http://localhost:8000/api/instances/` and GET `http://localhost:8000/api/users/me/` (repeated) | Legacy account bootstrap; reaches legacy sign-in    |

The settings capture proves those calls occurred but was truncated, so it is not an exhaustive inventory of that destination. No settings save was attempted. Settings/Preferences use existing full-page URLs instead of embedding the legacy profile modal. Inbox, other sidebar modules, workspace settings/invitations/create, the legacy home Stickies widget, and Advanced Plane customization remain legacy boundaries. Their requests are not silently redirected or represented as migrated. The native palette owns only Create new sticky and Open all stickies; help shortcuts/updates use existing documentation URLs.

## Tests and limits

- Exact backend archive: 694 tests /115 files and TypeScript passed before local deployment.
- Final frontend archive: production build passes; two route-ownership plus six draft/recovery behavior tests pass (8 total).
- Focused Oxc/format and diff checks pass. Toolchain policy verifies native TypeScript 7.0.2 and Oxc across 22 manifests.
- Shared working-tree web typecheck passes, but this includes unrelated paused work. After route type generation, the isolated committed tree reports eight errors in two unchanged inherited test fixtures: six missing `signupEnabled`/`isSelfManaged` properties in `convex-core/__tests__/auth-policy.test.ts`, and two widened `health` strings in `project/native/__tests__/portfolio-data.test.ts`. Those files have no diff across this slice. Therefore a clean committed-tree global type gate is **not** claimed.
- No performance delta or production deployment claim. Public UI baseline remains the previously selected deployed presentation.

## Hunk provenance and ownership review

| Commit / scope                                    | Production owner and necessary change                                                                                                                                                                           |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `1a2617389c` backend Stickies + tests             | Canonical private note owner supplies exact write acknowledgements and revision-checked indexed drag positioning. No client midpoint arithmetic or schema replacement.                                          |
| `c6c0254488` shell/shared presentation + receipts | Extract actual legacy presentation into shared owners; native generated identity/workspace records select transport. Both callers consume shared layout/menu/search components; no fabricated legacy DTO/store. |
| `86459a211b` native feature/shared editor + tests | One provider and per-note serial draft queue own page and modal. Shared legacy callers retain presentation. Deletes capture revisions, navigation protects unsaved work, moves serialize with saves.            |
| `1145544e98` route                                | Replace standalone native header with shared preserved shell, native session boundary and real workspace directory. Removes duplicate route presentation.                                                       |
| `59920c5691` draft error + BDD                    | Display canonical Convex public error data, retaining draft/revision; fixes the observed browser defect.                                                                                                        |

Root sampled the runtime path, shared consumers, draft queue and backend acknowledgement contract, and exercised the actual route in Chrome. Broader project/auth/onboarding work and editor/UI manifest/lockfile changes remain outside these commits. Source-only receipts from the agents do not substitute for the browser evidence above.
