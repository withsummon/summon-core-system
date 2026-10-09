# Native reporting frontend slice

## Product job and design decision

Help a workspace member assess delivery, commercial pipeline, knowledge and meetings within an explicit project/client/date scope. Reports are read-only, user-triggered traversals. Complete contribution coverage is required before publishing totals; Refresh starts a fresh traversal. Filter changes remove the previous result and cancel in-flight scope work. Project overview remains reactive and only presents its explicit recent-task window.

Two inspected Mobbin references informed the arrangement:

- [Seline dashboard](https://mobbin.com/screens/31becc74-4060-407f-8102-4516d7cf38b6): adjacent scope/date toolbar, aligned primary metrics, supporting breakdowns below.
- [Vimeo dashboard date filter](https://mobbin.com/screens/3de2cbeb-e6c0-42c4-a0c9-9123a6147b0c): explicit start/end selection and Apply action before recomputing a report.

| Baseline / alternative                       | Decision                                                                                                                 | Acceptance                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| No native reports surface                    | Add a lazy Reports module; group delivery first, then commercial/knowledge and project health                            | Member can run a scoped report without navigating legacy services |
| Continuous recomputation on every field edit | Use explicit Run/Refresh because multi-page traversal is not globally atomic                                             | No previous-scope or partial counts visible after scope changes   |
| Uniform metric and supporting text sizes     | Use existing numeric typography tokens (`text-12/14/28`); default Tailwind `text-sm/2xl` are reset by the existing theme | Metric values and headings have distinct hierarchy                |
| Wide desktop metric row                      | Four columns desktop, two narrow; filters stack                                                                          | No horizontal overflow at 390px                                   |

## Implementation

`apps/web/core/components/convex-core/reporting/` owns form scope, traversal, exact decimal aggregation, result composition and project overview. Generated Convex API types own scope and contribution contracts. `core-workspace.tsx` adds lazy navigation and a project overview panel. No dependencies added.

`readReportPages` follows continuation cursors, including empty permission-filtered pages, and throws on cancellation or any page failure. Six domain traversals run concurrently; each domain remains sequentially paginated. Only a fully resolved result enters display state. Per-page updates are progress, never shown as counts. Reports do not auto-refresh or promise a historical transaction snapshot. Accounting/files/automation omissions are visible.

## Verified behavior and rendered evidence

- Four module-local Node behavior tests: continuation through empty filtered pages; cancellation rejects stale completion; later-page error discards earlier counts; decimal sums preserve large and negative sub-unit values.
- Native web TypeScript, focused Oxlint and formatting pass.
- Actual Chrome on `http://127.0.0.1:3010/core?workspace=northstar-convex-qa&module=reports`: whole workspace report showed 2 tasks / 1 completed / 2 projects / 1 client / 1 opportunity / 1 document / 1 meeting. Switching Project to Northstar Release immediately removed prior totals; Run returned 1 project, 2 tasks, 0 clients/opportunities/documents and 1 meeting. Through=2000-01-01 yielded zero counts and an empty project message.
- Inspected desktop screenshot at 1728px and constrained 390×844 viewport, including lower metrics/project list. Native date entry verified with browser AX setValue + Enter; Playwright fill alone did not dispatch a committed controlled change in this browser bridge. Viewport override reset afterward.
- Project deep link `http://127.0.0.1:3010/core?workspace=northstar-convex-qa&project=NSTAR` displayed the native overview and existing task list together.

This is local development runtime and visual evidence. It does not claim a deployed production build or legacy reporting retirement.

## Completed-report CSV export

`reporting/summary.ts` is the shared aggregation owner for displayed metrics and export rows. The loader marks coverage complete only after all six domain traversals finish. The CSV action appears only for this completed result and disappears on scope changes; loading/error states cannot export. Applied workspace/project/client/date scope, due-bucket day, completion time and non-atomic traversal caveat are included. Supported legacy rows retain Section/Label/Value ordering: project count, issues/completed/overdue, clients/opportunities/pipeline, knowledge pages, meetings, project health and opportunity stage values. Client status details, file counts, automation jobs and recent activity remain unavailable rather than exported as zeros. No accounting fields are invented.

The existing shared `csvDownload` owner in `packages/utils/src/file.ts` previously joined raw cells and used an encodeURI data URL. Quotes, commas, newlines and URL fragments could corrupt exports, and spreadsheet formulas were not neutralized. It now uses the module's `serializeCsv` RFC 4180 quoting/CRLF plus a Blob download. Exact cell values remain the default for credential exports. Reports explicitly opt into `{ formulaProtection: "text" }`, which prefixes formula-like text while retaining plain decimal cells such as -0.10 as numeric values. Existing API-token and both webhook callers keep the same object/row signature, property order and filename behavior. No actual credentials were read or logged during testing.

Verification: 11 module-local tests passed (shared CSV owner tests in `packages/utils/src/__tests__/csv.test.mjs`; report tests under its own `__tests__`). Utility build/native types and native web types passed. Actual Chrome Run → Download CSV produced `/Users/valtrizt/Downloads/summon-report-2026-09-26.csv`, 1124 bytes, 28 three-column rows, CRLF. Python CSV readback matched visible report totals: 3 tasks, 2 projects, pipeline 0.00. The browser bridge download-event wait timed out, but the fresh downloaded file and exact contents independently confirmed the click succeeded. Large decimals are preserved as exact CSV bytes; third-party spreadsheet import settings still govern numeric coercion.
