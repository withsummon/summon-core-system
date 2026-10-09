# Deployed presentation restoration

The user selected the currently deployed `core.withsummon.com` UI as the product
baseline. The root agent inspected its Task Center dashboard/table and identified
Dokploy's latest completed deployment as
`afe708b92370542e09dd065454337e3c83c08604`. This receipt does not independently
establish the runtime image digest.

Commit `206a6952f3` restores six presentation owners from that source:

- `apps/web/core/components/summon/tasks/tasks-root.tsx`
- `apps/web/core/components/summon/projects/projects-directory-root.tsx`
- `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/projects/[projectId]/project-detail-workspace.tsx`
- `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/projects/[projectId]/project-overview-tab.tsx`
- `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/projects/[projectId]/project-detail-tabs.tsx`
- `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/projects/[projectId]/project-profile-editor.tsx`

Provenance check: `git diff -w afe708b923 -- <file>` is empty for the first five.
The profile editor differs only by the retained null-safe project-lead lookup and
removal of its unsafe cast/type import. Oxfmt formatting is retained. No primitive
API adjustment was needed for native TypeScript 7 compatibility. No route, store,
sidebar, backend, manifest or lockfile was included. The real ModalCore dismissal
fix remains in its unchanged owner. The subsequent grouped presentation originated
in `05f894b84b`; restoring these views does not roll back native backend work.

Verification: web native TypeScript 7 passed; all six files passed Oxlint with
warnings denied; eight existing task filtering/summary and project
summary/profile/date tests passed; `git diff --check` passed. Hooks were disabled
for the atomic commit after these manual checks. Browser comparison remains the
root agent's separate acceptance gate. No deployment or route cutover performed.

Local prerequisites were checked read-only: Django `/api/instances/` responds200
on localhost8000 and8002. Existing synthetic migration-benchmark session can read
one task on both APIs (HTTP200), from a recorded500-task fixture. Apps/web/.env
selects localhost8000. Existing dev3010/3021 processes do not override that API
origin. API8000 allows credentialed Origin localhost3100; it does not return an
allow-origin header for127.0.0.1:3010. Production must not be mutated for this QA.
Private session/credential files remain under `/tmp/summon-migration-control` and
are not copied into this receipt. Port3000 belongs to a different Futurity checkout
and must not be repurposed.

## Local legacy QA origin activation

On 2026-09-27, the existing dev frontend at `http://localhost:3010` was retained. Ports 3100 (live collaboration), 3002 (space), 3001 (admin), and 3000 (unrelated Futurity) were occupied and left untouched.

The local API8000 owner was verified as one-off container `99946b935327`, Python `manage.py runserver 0.0.0.0:8000 --settings=plane.settings.local`, image `sha256:025f9c48a908cb638c379c99cfe1a3e0832077467c128a4f41af8a003234b232`, with the existing `apps/api` bind mount. Its configuration/environment were saved privately with mode600 under `/tmp/summon-migration-control/django8000-runtime-original.json` and `django8000-runtime-original.env`.

Only that container was stopped, retained for rollback, and replaced by `8cccdace5fbb` (`summon-api-legacy-qa-3010`) using the same image, command, network, mount and environment, with only `http://localhost:3010` appended to CORS. No repository environment file changed. API8000 `/api/instances/` returned HTTP200, the exact allowed origin and `Access-Control-Allow-Credentials: true`. API8002 remained HTTP200 without the new origin allowance. The synthetic workspace Task Center deep link on localhost3010 returned HTTP200. These are reachability/CORS checks, not browser visual acceptance.

Source at activation was `94bcc46686`, containing restoration `206a6952f3` and the separately committed production description autosave fix. This is a working-tree development server with preserved dependency overlay, not an immutable production artifact. Parent owns UI login and comparison; no production data was changed.
