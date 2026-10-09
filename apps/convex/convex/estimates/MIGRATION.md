# Native estimates

## Owners and boundaries

Inherited models are Estimate and EstimatePoint in `plane/db/models/estimate.py`; app system/point controllers live in `app/views/estimate/base.py`. ProjectEntityPermission permits project members/admins to change systems and points; individual point decorators agree. System type is categories or points, name is project-unique, point key is a nonnegative integer and value is a string up to 20 characters. Duplicate keys are retained because the inherited model explicitly does not enforce uniqueness. Point deletion shifts greater keys down by one. Project active estimate selection is project-settings behavior: native requires a current project administrator, consistently with existing native settings; the inherited project controller additionally allowed workspace administrators. No new workspace-admin bypass is granted.

`estimates` owns system/point CRUD, selection, and resumable deletion/replacement. Live system/point counts are capped at 100 with indexed deleted-state filtering; removed history cannot consume capacity. Names, value, description and revisions are checked at mutation boundaries. Project members can read available systems; guest assignment/configuration writes are denied. Each direct read requires current project access.

Task and draft properties reference the same estimatePoints ID through `tasks/properties.validateProperties`; there is no parallel task assignment store. New selections must belong to the active system in the same project. Switching systems does not silently erase historical task assignments. An unchanged old task assignment can survive an unrelated edit; newly assigning it cannot. Draft save/publication and copying revalidate the selected point, rejecting inactive/retiring references until explicitly corrected. Existing native create/update, intake initial properties, rich description, task status and lifecycle owners retain their existing behavior.

## Bounded replacement

Begin captures source system/point revisions and a replacement point (or null). It marks source points retiring and locks project estimate configuration. New references to retiring points are rejected. Whole-system deletion can clear assignments, or move them to a point in a different currently active system; selecting that other system happens before beginning the operation.

Each explicit page processes at most 20 task or draft candidates and at most 1 MiB, rechecks current project write access and job revision, and atomically commits reference changes plus progress. Task changes reuse taskChanged and its notification/event owner. Draft changes update private contentRevision and aggregate updatedAt without exposing draft bodies or authors in job results. Stale page retries reject without consuming another page; completed retries return the completed receipt. Any currently authorized project writer can resume a stopped job. Already committed pages remain committed; there is no misleading rollback/cancel affordance.

Finalization retires source points/system only after both task and draft scans finish, clears the project lock and updates selected system when deleted. Configuration cannot change beneath a job. Retained removed/published task records are handled as references; published draft snapshots remain historical and are not rewritten. Parent/task relationships and task IDs are unchanged. Draft publication CAS rejects approval captured before its reference changed.

## Additive reference migration

`taskProperties.estimatePointId` is now required and nullable for task records, draft properties and explicit property writes. New creation uses the canonical null default. The temporary migration and omitted-field compatibility branches have been deleted. The primary verified backfills on both hosts: local 1,508 tasks and 4 drafts; remote 2 tasks and 1 draft; second scans changed zero rows in every table. No historical Django estimates were imported by this step.

Native property forms send the explicit current point. Unrelated task edits may retain the same valid historical assignment when its system is inactive; this is the intentional owner contract, not omitted-field compatibility. Draft save, copy and publication still validate against current active selection. Old immutable QA frontend artifacts are not supported by this tightened write contract.

## Verification and remaining boundary

Module-local BDD covers writer/guest permissions, revision conflicts, active-system switching, retained task selection, stale draft publication, foreign-project references, 23-task plus draft replacement over multiple pages, stale retries, revocation/resume, whole-system deletion/selection clearing, and historical draft labels. Backend types and scoped lint pass; the full backend suite passed 383 tests before the final whole-system test was added. Actual deployment, both-host migration receipts, native UI and Chrome acceptance remain separate gates.

Legacy REST/PAT routes remain registered. Workspace aggregate estimate directory, imported IDs, project clone/template mappings, time-range estimate analytics and deleted-system recovery are not claimed by this slice. No bulk deletion scans the whole project in one transaction and no notification is sent outside the existing task event owner.

## Independent owner review correction

Single-point remap completion now advances the aggregate system revision after point retirement/key shifts, matching create/update point semantics. A configuration approval captured during the running job is rejected after completion; a module regression proves the stale create-point request fails. `selection.forDraft` exposes the owner's current or historical point/system label only after private draft and current project access checks; tests cover other administrators, anonymous access and project revocation. Seven estimate tests, native TypeScript7 and scoped Oxc pass for this corrective slice. Deployment of this correction is not asserted here.
