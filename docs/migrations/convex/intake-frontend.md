# Native intake admission frontend

## Domain and target experience

This screen helps project reviewers inspect submitted work and make an explicit admission decision. Legacy references traced are `components/inbox` (creation title/description/properties, status, snooze and duplicate selection), the project intake settings header, and the generated native intake contract. The native flow preserves the canonical task ID and sequence through acceptance; triage is not a second copied task model.

The screen UX pass inspected these references:

- [Linear issue list](https://mobbin.com/screens/980af8d9-c125-4164-90ed-727692cd6946): compact identifier/title rows and secondary metadata make a long work queue scannable.
- [Linear inbox/detail](https://mobbin.com/screens/beb9d6b3-ec34-46d7-9332-320fcb32a338): selected work has a clear title and a distinct detail area.
- [Jira issue detail](https://mobbin.com/screens/f95ce716-07ef-4c1c-9a29-165ff2167e0b): primary identity and workflow status sit above description and linked work.

These are inspected structural references, not exact intake-decision examples. A targeted triage-action search failed; its narrower retry returned the Linear inbox above. Decision semantics therefore follow the repository's actual Plane/native owners.

Two compositions were considered: another permanent inbox sidebar beside Core navigation, or a compact status-filtered list opening a focused detail. The latter keeps the existing shell usable at 390px and gives description/review forms the full available width. Implemented commitments: identifier and title first, no guessed counts, reviewer actions grouped at the top, snooze/duplicate fields revealed only for their decision, and no blank description editor in read-only detail.

## Public flow and owner boundaries

Open `/core?workspace=<slug>&project=<identifier>&projectView=intake`. Filters use `intakeStatus`; detail uses `intake=<task-id>` resolved by the backend and checked against the selected authorized project. A local unavailable boundary keeps Back to intake reachable after removal/revocation.

Project Settings renders `IntakeSettings`: enable submissions and configure guest visibility using the backend's `canConfigure`, with a captured project metadata revision. Submit is available while enabled to current project members, including guests. The submission form uses the existing TaskRichEditor and shared controls for title, HTML description and priority. Guest edits omit priority unless the canonical `canEditPriority` permits it.

Detail uses canonical `canEdit`, `canDecide` and `canRemove`; no second role policy is added. Edit, review and removal capture both intake and task revisions. Peer updates do not replace the saved draft or silently refresh expected versions. Review offers pending, accepted, rejected, snoozed and duplicate. Snooze converts an explicit local date/time to epoch milliseconds; it does not claim automatic status changes after expiry. Duplicate choices come from bounded ordinary project-task pages. Acceptance exposes the same task through an actual project-task link, clearing intake/lifecycle route parameters.

Removal states its consequence before confirmation: an accepted task remains ordinary project work; a nonaccepted task is hidden together with its intake entry. There is no public intake restore UI. This distinction follows the captured submission status and its protected revision.

`tasks/options.ts` separates generated writable status choices from exhaustive read labels. Triage has a read label but is absent from ordinary status selectors. The backend excludes the managed triage state from the state-list producer. Assistant proposal state also derives from its generated writable mutation argument rather than the broader stored task status union.

## Changed owners and verification

New frontend owners: `intakes/{intakes,forms,decisions,settings}.tsx`. Existing project navigation and Settings mount them. Existing task detail, task center, taxonomy and assistant action projections reuse the shared read labels. No new dependencies or generic endpoint adapters were added.

Scoped lint passed with zero warnings/errors across eleven files. Native intake BDD suite passed six cases. Native web TS7 passed after the backend state-list owner narrowed its return type; no frontend cast or impossible-status fallback was added. Scoped diff whitespace checks passed. Primary Chrome verification remains pending: enable/disable intake; guest submit and restricted edit; peer privacy toggle; rich save; stable identifier on accept; missing-default conflict; explicit snooze/duplicate; stale settings/edit/decision; accepted/nonaccepted remove consequences; ordinary task selectors exclude triage; desktop and 390px layout.

## Explicit remaining parity

History, attachments, public/PAT submission, import sources, bulk review, automatic snooze wake-up, richer submit-time assignee/label/date controls, full filter/search parity and intake restore remain outside this slice. Legacy routes remain registered. The inspected visual references and passing code checks do not establish rendered visual quality; the primary owns Chrome acceptance and deployment/backfill verification.

## Primary checkpoint, 2026-09-27

Primary checks passed: 292 backend tests across 34 files, 19 frontend tests, 30 native TypeScript tasks, 21 lint tasks and 21 formatting tasks. Local functions deployed at 13:05:02 Jakarta time.

Chrome verified project enablement, title/description submission, acceptance with the same task ID and NSTAR-4 sequence, and the actual ordinary-task deep link with preserved description and default project state. A separate guest session could not see the owner submission in Accepted, could submit its own NSTAR-5, and saw title/description-only edit controls with no review action. Desktop and 390px detail were visually inspected; text and controls fit and document width matched 390px. The temporary viewport override was removed.

Remaining browser checks: peer CAS conflict, snooze/duplicate controls, guest visibility toggle, disablement, and removal consequences. Backend behavioral tests cover these contracts but do not establish their browser acceptance. Remote deployment remains at the earlier committed snapshot; this intake checkpoint was deployed locally only.
