# Project saved views frontend

## Intended experience and evidence

This screen helps project members reopen a meaningful task subset without rebuilding its filters. Saved definition identity and actual matching work are the primary content; creation/editing is a separate explicit workflow.

Inspected references:

- [Linear saved view](https://mobbin.com/screens/610d34b6-6ad8-45ab-80fb-2107b31ed01e): named view above real issue rows, save actions grouped with definition identity.
- [Linear filter selection](https://mobbin.com/screens/2579f037-4e90-4330-ac35-19323ca9828a): properties progressively disclosed rather than a permanently expanded filter wall.
- [Jira custom filters](https://mobbin.com/screens/3225881e-ea75-4d18-9404-252b4015b961): concise saved-name/description rows; metadata management separate from work results.

The existing legacy project view list/form and native TaskCenter were inspected. A permanent three-column filter/list/detail layout was considered and rejected for this bounded project scope: it would compete with existing workspace/project navigation and leave little room at 390px. Chosen structure is saved-view list → named reactive results, with explicit create/edit and grouped filter controls. Existing shared controls and task links remain the implementation foundation.

| Constraint                                   | Adaptation                                                       | Acceptance                                                |
| -------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------- |
| Many supported filter clauses                | Group choices in the editor; keep saved results primary          | Results are reachable without traversing an expanded form |
| Candidate pagination may produce empty pages | Explicit load more, no page-local count or global ordering claim | Empty candidate page still permits continuation           |
| Shared definition, personal favorites        | Separate favorite action from metadata/lifecycle edit            | Guests see only generated available capabilities          |
| Concurrent metadata changes                  | Capture revision when opening editor/confirmation                | Conflict preserves the draft                              |

## Scope

Project saved definitions and newest-created task results only. No workspace view, grouping, arbitrary sorting, publication, or complete legacy display-preference parity claim. Backend owns filter matching, lifecycle, and permissions. Desktop and 390px layouts were inspected in primary Chrome QA on 2026-09-27; headings, controls and task rows remain readable without horizontal overflow.

## Implemented contract

The `Views` project section uses `savedView` for its normalized deep-link ID and `savedViewTab=all|favorites|trash` for bounded lists. Create/edit captures the initial canonical definition and revision. Choice directories merge the canonical stored selection labels, so membership pagination or revoked members cannot silently erase a filter. The editor states any-within-group versus all/any-between-group semantics and supports inclusive independent start/target ranges.

Detail renders canonical saved filters and live backend task results. Definition revision changes reset that result cursor; task changes retain reactive pagination. Task links clear view/lifecycle selection and open the normal project task owner. No total count or page-local sorting is presented. Personal favorites use the generated flag and API. Remove/restore confirmations preserve the captured definition revision and do not alter tasks.

## Checks

Primary verification: 307 backend tests across 37 files and 21 frontend tests passed. Root native TS7 (30 tasks), lint (21 tasks) and format (21 tasks) passed before the final choice-retention fix; the frontend suite, native web TS7, scoped zero-warning Oxlint and Oxfmt passed again after that fix. Local Convex deployment on port 3210 succeeded. The exact committed slice was subsequently deployed to the remote backend and built as a production frontend artifact; see `checkpoints/5ed8c4493a-remote.json` for served identity and the narrower remote browser evidence.

Chrome acceptance on local port 3010:

- Created a Done-only project view and reopened its canonical definition/results. A second owner tab moved NSTAR-4 into Done and back to To do; the view included and removed it live without reload.
- Favorited the view, removed it into Trash, verified Favorites no longer exposed it, then restored it and verified the personal favorite returned.
- Edited the name and added To do; results showed the expected To do and Done tasks in newest-created order. The guest deep link showed “This saved view is unavailable” under the current project access settings.
- Inspected desktop and 390px rendering; the narrow page measured 390px with readable wrapped controls and task rows. Temporary viewport override was cleared.

Remaining browser coverage: the full any/all/date filter matrix, stale metadata conflict, task deep-link and keyboard-only journey, and deletion of a choice during an open draft. Backend BDD covers filter semantics and stale revisions; it is not a substitute for those unexercised browser cases. Django and legacy view routes remain registered.

## Live choice disappearance review

Peer review found that a newly selected draft label/state/member could disappear from its directory while retaining a hidden filter ID. The choice owner now unions live choices, initial saved projections, and every current typed draft selection. Missing draft choices remain explicitly unavailable and removable; no ID is silently dropped or cast. Module-local tests cover select → live option disappears → remove from draft, and live-label precedence with duplicate assignee/creator IDs. Both tests, native web TS7, and scoped lint passed. This is source/behavior verification; the browser deletion-during-edit journey remains a separate QA check.
