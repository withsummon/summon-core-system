# Native project modules — bounded slice

Implemented locally; no deployed acceptance yet. Legacy owners: `apps/api/plane/db/models/module.py`, `app/serializers/module.py`, `app/views/module/{base,issue,archive}.py` and frontend module services/stores.

The schema owns explicit status, rich HTML plus sanitizer-derived text, independently nullable ISO start/target dates, lead, lifecycle and monotonic revision. Names are trimmed, case-sensitive and unique among nondeleted modules in one project, including archived modules. Indexed uniqueness prevents races without scanning the project or imposing a project-wide module cap.

Current active-project/workspace ACL governs every request. Guest readers can read; members/admins can write. Lead and roster additions must reference active members of both project and workspace; guest membership is allowed and confers no new permission. Existing associations remain historical after revocation and can be removed. An unchanged lead can be preserved on unrelated updates; newly attaching or changing a lead always checks current membership. Detail projects lead identity independently of directory pagination; roster identity is paginated. The choices query shows only current active project/workspace members. Roster is a relation with per-person mutations and bounded pages, not an arbitrarily limited array.

Module/task links are many-to-many. Adding/removing one link preserves all others and uses the canonical task revision/event owner atomically. No-op repeats do not generate events. Module deletion preserves tasks and links, with explicit native recovery; restoring does not recreate removed links. Archived modules cannot be edited. Only completed/cancelled modules can be archived; unarchive preserves status. Creator or current project admin may delete/restore with write access and CAS. Restore rechecks name availability. Legacy `restoreModule` means unarchive, not trash recovery; native trash recovery is a deliberate extension.

Every growing public query uses bounded pagination (1–100 candidate rows, 1 MB). Filtered pages may be empty while the cursor continues. No global totals are inferred from a page.

Remaining legacy parity: favorites, module links, full rich JSON representation, filters/display properties, ordering/logo/external IDs, burndown/analytics, workspace dashboards, detailed module activity payloads, configurable guest feature policy, legacy REST/PAT external contracts. No legacy endpoint is retired by this slice.

## Owner review and evidence

The generated API derives module inputs and rows from `modules/schema.ts` and registered functions. Shared commercial date/text/page budgets and task rich-content/revision/event owners are reused; no duplicate client DTO, manual HTML conversion, global count or module-specific task event pipeline is introduced. Bounded indexed lookups own uniqueness and pair membership. Lifecycle changes update module revisions; task relation changes update canonical task revisions/events atomically. No schema backfill is needed for new tables.

Local verification: six public-boundary journey tests cover rich sanitization, dates, uniqueness, many-to-many/idempotence, monotonic CAS, archive restrictions, reversible deletion/name-conflict recovery, guest/read-only roster semantics, project revocation, historical lead preservation and cross-project rejection. Native TypeScript and focused Oxlint with complexity checks pass. Browser acceptance and deployment are owned by the coordinated migration checkpoint.

## Primary local acceptance

Backend deployed at 08:20:53 on 2026-09-27. Primary source review sampled canonical ACL, name uniqueness/restore conflicts, lead and roster membership validation, independent task links, revisions and shared sanitizer ownership. Full 30-task native type gate passed. Running behavior tests concurrently with that gate initially failed while the type pipeline rebuilt/cleaned shared package output; the sequential rerun passed all 256 backend tests and 19 frontend tests. This transient run is not a product regression or performance sample. Build-producing gates and runtime tests must run sequentially.

Chrome verified creation with a target date and no start date, rich description, guest lead and roster addition without write access, realtime task visibility, stale metadata rejection with draft retained, completed-module archive removing edit controls, unarchive, Trash discovery/restore with roster and task link retained, and the same task linked independently to two modules. Removing it from the second module preserved the first link. A 390px inspection found an unnecessary empty-description editor box; the detail now omits it, and the corrected layout remained within 390px with readable actions. Temporary viewport state was reset.

Live remote acceptance, provider integrations and remaining legacy feature parity are not implied by these local checks.
