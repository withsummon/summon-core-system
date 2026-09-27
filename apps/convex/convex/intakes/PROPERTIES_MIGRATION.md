# Intake properties

Registered intake-issues/<issue_id> PATCH in app/views/intake/base.py permits
ordinary project members to update IssueCreateSerializer properties, even when
not the creator. Its guest branch restricts issue_data to name/description, while
intake decisions remain administrator-only. The inherited browser is narrower
(creator/admin isEditable); native writer edit deliberately follows the registered
backend capability and makes it visible in the real consumer. Native current
project membership remains required even for workspace administrators.

Native intake capabilities now expose canEditProperties for project/workspace
writers. Writer-or-creator/admin may edit text; guests may edit their own text
only. Removal and decision authority are unchanged. Existing guest creation may
choose priority, as before; richer assignment controls are writer-only. This does
not claim parity with unrestricted legacy creation payload assignment.

The schema exports shared nonStateTaskProperties and ordinary taskProperties
extends it with stateId. validateNonStateProperties owns dates, active writer
assignees, project labels and retained/active estimate references. The existing
ordinary validator adds state validation; it still rejects triage. Intake create
and edit reuse the non-state owner and never accept state/status inputs. Creation
uses the same atomic createTask identity/sequence owner. Editing uses both intake
and task revisions, preserves triage/admission state and records task activity.
Optional properties mean retain stored properties on edit or canonical defaults
on creation; this is an intentional partial update contract, not migration data.

Existing submission metadata edits omit HTML. A separate description endpoint
uses the shared content-version token and same-task image validator/writer; own
asset uploads do not invalidate that token, while concurrent content writes do.
Saving description advances task/intake revisions, so an older metadata form
conflicts rather than overwriting newer content. Initial submissions retain the
plain rich editor before their stable task identity exists.

Four module-owned BDD cases cover noncreator writer edit, unchanged removal
rights, stale CAS and revocation; guest text-only behavior; foreign labels,
assignees/estimate and invalid date rollback preserving text/history/events; own
image upload/save, stale content and metadata conflicts, admission followed by
metadata-only edit preserving the image, and guest creator description access.
The full backend suite passed 609 tests, including ordinary task creation,
property updates and draft validation; native TypeScript 7 passed.
Browser acceptance and deployment of this slice are not yet verified.
No opaque intake JSON settings, parent/cycle/module assignment, metadata/default
intake lifecycle, source integration or REST compatibility is implemented here.
