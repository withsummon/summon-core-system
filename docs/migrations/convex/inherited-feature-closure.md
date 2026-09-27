# Inherited Plane feature closure

The user confirmed every inherited Plane feature is required on 2026-09-27. This is a remaining-work map, not a claim of exhaustive route parity or completed migration. Django remains the production owner for inherited routes until each replacement preserves its actual public contract.

## Required families

| Family | Existing owner | Required closure |
| --- | --- | --- |
| Intake/inbox | `app/urls/intake.py`, `app/views/intake/base.py`, `db/models/intake.py` | Submission and triage visibility; pending/rejected/snoozed/accepted/duplicate states; description history; duplicate/source metadata; public intake and inbox aliases |
| Saved views | `app/urls/views.py`, `app/views/view/base.py`, `utils/issue_filters.py` | Personal/shared access, ownership and locking, guest policy, favorites; actual filter/order/group execution with authorized result pagination |
| Import/export and integrations | `app/urls/exporter.py`, `app/views/exporter/base.py`, `bgtasks/export_task.py`; web integration services | CSV/XLSX/JSON export jobs and history; resolve missing registered importer owner before replacing GitHub/Jira UI contracts |
| Public API and sharing | `api/` v1, `space/urls/`, `app/urls/api.py`, `app/urls/webhook.py` | Personal API tokens/expiry; external wire contracts; signed webhook delivery/logs; publication flags, anonymous/authenticated boards, comments/reactions/votes/assets |
| Identity, administration and personal workspace | `authentication/`, `license/urls.py`, user/workspace routes | OAuth/magic codes/recovery, identity linking, profiles/sessions/invitations; distinct instance-admin authority; drafts/favorites/quick links/preferences |

The existing native cycle/module/task receipts also retain explicit omissions such as analytics, bulk operations, links, feature policy and public APIs. Those omissions remain required work under the confirmed scope.

## Route evidence

Primary source sampling confirmed quick-link collection/detail routes in `app/urls/workspace.py`, export-issues in `app/urls/exporter.py`, personal API tokens in `app/urls/api.py`, webhooks/logs in `app/urls/webhook.py`, intake-issues in `app/urls/intake.py` and favorite-view routes in `app/urls/views.py`. `space/urls` registers anchor-scoped issues, settings, metadata, cycles/modules/states/labels/members, comments/reactions/votes, intake and assets. `license/urls.py` independently registers instance admins, sessions, configurations, email checks and workspace administration.

The web GitHub/Jira/integration services reference importer URLs, but a source search found no corresponding registered importer route in this checkout. Preserve that distinction: the UI contract exists; a working server implementation has not been established. Native report CSV does not replace the separate registered asynchronous exporter.

## Current closure sequence

Personal workspace quick links are implemented and locally verified; their receipt records the remaining legacy REST caller boundary. Intake admission now preserves task identity and reserved-triage visibility. Chrome verified same-ID acceptance, duplicate selection, explicit snooze, stale-decision rejection, guest visibility changes and enablement. Recovery and shared description history are the next bounded closure work; their receipts distinguish automated checks from browser proof.

Saved views require executable authorized filters, ordering and pagination together with their access/ownership rules. Metadata-only views will not count as migration. Export jobs, external APIs/webhooks, public sharing, identity and instance administration remain required before retirement.
