# Preserved UI migration: local backend checkpoint

The user-selected visual baseline remains the deployed dashboard/table UI at
`core.withsummon.com`. Native entry and project controllers under construction
are not registered as production routes. The `/core` surface is migration QA.

## Source and local activation

Source: `ff20bac2449a35c24512a2a9f9585093b93c9e20`.

An isolated Git archive of `apps/convex` and `packages/editor` passed 684 backend
tests across 115 files and native TypeScript 7 checking. Existing installed
dependencies were linked into the archive; this is not a clean lockfile install.
Editor source was unchanged from the previously verified `d157ffac02` archive,
so its existing compiled output was reused. Concurrent working-tree edits were
excluded.

That archive was deployed to `http://127.0.0.1:3210`, with the full source hash
in its deployment message. The CLI completed schema validation and finalization
without index deletion. The bounded project-network backfill traversed all 12
local projects: the first pass initialized 12 missing values to private; the
second traversed the same 12 and changed zero. Existing privacy is preserved.

Local evidence under `/tmp/summon-migration-control/`:

- `ff20bac244-archive-tests.txt`
- `preserved-ui-ff20bac244-local-deploy.txt`
- `preserved-ui-ff20bac244-local-backfills.json`

## Independent review and browser check

Root sampled the invitation delivery, preview, shared response and membership
owners, then independently ran all 11 delivery tests. Token and verified-recipient
entry paths converge on the same atomic membership transaction. Logo reads
reauthorize after byte access; generic asset access is not broadened. Provider
failure is reported explicitly. Interrupted sends still lack guaranteed eventual
delivery, as documented in `invitation-delivery-entry.md`.

In Chrome, the existing local QA account successfully signed in at
`http://localhost:3021/core?workspace=northstar-convex-qa` after activation. The
Northstar Delivery workspace, its two project choices, existing shortcuts and
recent items rendered with Live status. This is a compatibility smoke check of
the QA client, not acceptance of the preserved production UI or new onboarding.
No account creation, credential change, invitation email or production mutation
was performed.

## Remaining boundary

The public deployment was not changed. Preserved auth/onboarding and project
journeys, their shell dependencies and remaining inherited Plane contracts must
be completed and browser-tested before route cutover or Django retirement.
No performance delta is claimed by this checkpoint.
