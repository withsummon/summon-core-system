# Summon Core Plane Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver `withsummon/summon-core-system` as a production-ready Plane fork with every approved Summon Core workflow, one canonical owner per domain concept, and verified availability at `https://summon-core.withsummon.com/`.

**Architecture:** Plane `apps/web` remains the only frontend and Plane `apps/api` remains the only backend. A workspace-scoped Django app, `plane.summon`, owns only CRM, meeting, external-resource, automation metadata, and credential-vault records; every project, work item, page, file, user, membership, notification, and preference remains owned by Plane.

**Tech Stack:** Plane v1.4.1, React Router 7, React 19, TypeScript, MobX, `@plane/ui`, Django 5, Django REST Framework, PostgreSQL, Redis/Celery as shipped by Plane, pytest, Docker Compose, Playwright.

**Spec:** `docs/plans/plane-fork-migration/plan.html`

## Global Constraints

- Baseline is `makeplane/plane` tag `v1.4.1`, commit `5662b761062b0b2f9d42a6578b55481b5b069792`.
- Preserve Plane copyright headers, `LICENSE`, and AGPL-3.0 source availability.
- Do not add Next.js, NestJS, Drizzle, a second API runtime, or a second frontend shell.
- Do not create custom Project, Task/Issue, User, Session, Workspace, Page content, FileAsset binary, Notification, or general Settings models.
- Every custom query and mutation is scoped by an active Plane `WorkspaceMember`; project-scoped references also require active Plane project access.
- No external LLM integration. Assistant and automation are deterministic over authorized canonical data.
- No new package is permitted unless the installed Plane stack cannot implement the requirement.
- No production secret, credential value, seed password, browser session, or deployment token enters source control, logs, screenshots, or test fixtures.
- Runtime data migration from the old Next.js/NestJS system is outside this scope; production starts from a fresh Plane database and safe seed/onboarding flow.
- The legacy repository and deployment remain available until the new production flow passes authenticated write/read-back UAT.

---

## File Responsibility Map

- `apps/api/plane/summon/models/`: only Summon-owned persisted records, split by commercial, collaboration, automation, and credential responsibility.
- `apps/api/plane/summon/serializers/`: request validation and response contracts; cross-workspace references are rejected here before writes.
- `apps/api/plane/summon/views/`: thin DRF endpoints that apply membership permissions and call domain services.
- `apps/api/plane/summon/services/`: opportunity transitions, meeting-to-Issue linking, deterministic document/assistant output, aggregate reports, and credential encryption/audit.
- `apps/api/plane/summon/permissions.py`: one shared workspace membership policy and credential grant checks.
- `apps/api/plane/summon/urls.py`: all custom endpoints below `/api/summon/workspaces/<slug>/`.
- `apps/api/plane/summon/migrations/`: schema generated from the allowlisted models only.
- `apps/api/plane/tests/contract/summon/`: contract tests for persistence, permissions, canonical ownership, transitions, and security.
- `packages/types/src/summon/`: the single frontend contract for Summon API payloads.
- `packages/constants/src/summon.ts`: navigation labels, route builders, and fixed domain vocabularies shared by the web app.
- `apps/web/core/services/summon.service.ts`: the only custom HTTP client; it extends Plane `APIService`.
- `apps/web/core/components/summon/`: shared page shell, empty/error/loading states, forms, tables, and cards built from `@plane/ui`.
- `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/`: workspace-scoped route components; each page owns only view composition.
- `apps/web/app/routes/extended.ts`: the complete Summon route tree.
- `apps/web/app/(all)/[workspaceSlug]/(projects)/extended-sidebar.tsx`: inserts Summon navigation into Plane's existing extended sidebar.
- `deployments/summon/`: production Compose override and documented environment contract; no secret values.

---

### Task 1: Fork Provenance, Approved Spec, and Branding Baseline

**Files:**

- Create: `docs/plans/plane-fork-migration/plan.html`
- Create: `docs/superpowers/plans/2026-08-21-summon-core-plane-migration.md`
- Create: `docs/architecture/summon-domain-ownership.md`
- Modify: `apps/web/public/manifest.json`
- Modify: `apps/web/public/site.webmanifest.json`
- Modify: `packages/constants/src/metadata.ts`
- Modify: `apps/web/app/root.tsx`
- Modify: `apps/web/core/components/auth-screens/header.tsx`
- Modify: `apps/web/core/components/auth-screens/footer.tsx`
- Test: `scripts/check-summon-boundaries.sh`

**Interfaces:**

- Consumes: upstream Plane v1.4.1 and the approved kickoff document.
- Produces: an executable allowlist check and product metadata used by every later task.

- [ ] **Step 1: Record the canonical ownership table**

Write `docs/architecture/summon-domain-ownership.md` with one row for each capability and exactly one owner: Plane or `plane.summon`. Include the model allowlist `Client`, `ClientContact`, `Opportunity`, `SummonProjectProfile`, `Meeting`, `MeetingParticipant`, `MeetingWorkItem`, `SummonPageContext`, `ResourceLink`, `AutomationTemplate`, `AutomationJob`, `GeneratedArtifact`, `Credential`, `CredentialGrant`, and `CredentialAccessLog`.

- [ ] **Step 2: Write the boundary check**

Create `scripts/check-summon-boundaries.sh` using POSIX shell. It must fail when tracked runtime files contain `summon_tasks`, `summon_projects`, `summon_users`, `summon_sessions`, `summon_notifications`, `@nestjs/`, or `drizzle-orm`, or when a tracked `next.config.js`, `next.config.mjs`, or `next.config.ts` file exists; ordinary prose referring to a prior Next.js migration must not fail the check.

```sh
#!/bin/sh
set -eu
if git ls-files | grep -Eq '(^|/)next\.config\.(js|mjs|ts)$'; then
  echo "Forbidden Next.js runtime config detected" >&2
  exit 1
fi
for forbidden in summon_tasks summon_projects summon_users summon_sessions summon_notifications @nestjs/ drizzle-orm; do
  if git grep -n "$forbidden" -- ':!docs/**' ':!scripts/check-summon-boundaries.sh'; then
    echo "Forbidden duplicate runtime detected: $forbidden" >&2
    exit 1
  fi
done
```

- [ ] **Step 3: Verify the check passes before customization**

Run: `sh scripts/check-summon-boundaries.sh`

Expected: exit 0 with no forbidden runtime output.

- [ ] **Step 4: Apply minimal Summon product metadata**

Set manifest name/short name to `Summon Core`, metadata title to `Summon Core`, and retain all Plane license headers and attribution. Do not replace every upstream string; only user-facing app/PWA metadata and the login brand are in scope.

- [ ] **Step 5: Run focused frontend checks**

Run: `pnpm --filter web check:types && pnpm --filter web check:format && git diff --check`

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add -- docs/plans/plane-fork-migration/plan.html docs/superpowers/plans/2026-08-21-summon-core-plane-migration.md docs/architecture/summon-domain-ownership.md scripts/check-summon-boundaries.sh apps/web/public/manifest.json apps/web/public/site.webmanifest.json packages/constants/src/metadata.ts apps/web/app/root.tsx apps/web/core/components/auth-screens/header.tsx apps/web/core/components/auth-screens/footer.tsx
git commit -m "chore(summon): establish Plane extension boundary"
```

---

### Task 2: Summon Django App and Non-Redundant Schema

**Files:**

- Create: `apps/api/plane/summon/__init__.py`
- Create: `apps/api/plane/summon/apps.py`
- Create: `apps/api/plane/summon/models/__init__.py`
- Create: `apps/api/plane/summon/models/commercial.py`
- Create: `apps/api/plane/summon/models/collaboration.py`
- Create: `apps/api/plane/summon/models/automation.py`
- Create: `apps/api/plane/summon/models/credential.py`
- Create: `apps/api/plane/summon/migrations/0001_initial.py`
- Modify: `apps/api/plane/settings/common.py`
- Test: `apps/api/plane/tests/contract/summon/test_schema.py`

**Interfaces:**

- Consumes: Plane `Workspace`, `User`, `Project`, `Issue`, `Page`, and `FileAsset` UUIDs.
- Produces: the exact model allowlist used by serializers and reports.

- [ ] **Step 1: Write a failing schema ownership test**

```python
@pytest.mark.django_db
def test_summon_model_allowlist():
    app = apps.get_app_config("summon")
    assert {model.__name__ for model in app.get_models()} == {
        "Client", "ClientContact", "Opportunity", "SummonProjectProfile",
        "Meeting", "MeetingParticipant", "MeetingWorkItem", "SummonPageContext",
        "ResourceLink", "AutomationTemplate", "AutomationJob", "GeneratedArtifact",
        "Credential", "CredentialGrant", "CredentialAccessLog",
    }
```

- [ ] **Step 2: Run the test and confirm the app is absent**

Run from `apps/api`: `pytest plane/tests/contract/summon/test_schema.py -q`

Expected: fail because Django cannot find app `summon`.

- [ ] **Step 3: Define workspace-scoped models with database constraints**

Use UUID primary keys and Plane audit fields. Add unique constraints for client name per workspace, opportunity identity per workspace, one Summon profile per Plane project, one meeting-to-Issue link per meeting, one grant per credential/member, and one generated artifact target per job. Enforce opportunity probability from 0 through 100 and an exactly-one target invariant for Page/FileAsset artifact links.

```python
class SummonProjectProfile(BaseModel):
    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE)
    project = models.OneToOneField("db.Project", on_delete=models.CASCADE, related_name="summon_profile")
    client = models.ForeignKey("summon.Client", null=True, blank=True, on_delete=models.SET_NULL)
    source_opportunity = models.OneToOneField("summon.Opportunity", null=True, blank=True, on_delete=models.SET_NULL)
    delivery_status = models.CharField(max_length=24, choices=DeliveryStatus.choices)
    phase = models.CharField(max_length=80, blank=True)
    health = models.CharField(max_length=16, choices=ProjectHealth.choices)
    start_date = models.DateField(null=True, blank=True)
    target_date = models.DateField(null=True, blank=True)
    budget = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
```

- [ ] **Step 4: Register the app and generate migration**

Add `plane.summon` to `INSTALLED_APPS`, then run from `apps/api`:

`python manage.py makemigrations summon --name initial`

Expected: only the 15 allowlisted models are created.

- [ ] **Step 5: Verify a clean database migration and model constraints**

Run: `pytest plane/tests/contract/summon/test_schema.py -q`

Expected: allowlist, uniqueness, check constraints, and cross-workspace relation fixtures pass.

- [ ] **Step 6: Commit**

```bash
git add -- apps/api/plane/summon apps/api/plane/settings/common.py apps/api/plane/tests/contract/summon/test_schema.py
git commit -m "feat(summon): add non-redundant domain schema"
```

---

### Task 3: Shared Permission Boundary and Commercial API

**Files:**

- Create: `apps/api/plane/summon/permissions.py`
- Create: `apps/api/plane/summon/serializers/__init__.py`
- Create: `apps/api/plane/summon/serializers/commercial.py`
- Create: `apps/api/plane/summon/services/commercial.py`
- Create: `apps/api/plane/summon/views/__init__.py`
- Create: `apps/api/plane/summon/views/commercial.py`
- Create: `apps/api/plane/summon/urls.py`
- Modify: `apps/api/plane/urls.py`
- Test: `apps/api/plane/tests/contract/summon/test_commercial_api.py`

**Interfaces:**

- Consumes: Task 2 models and Plane active membership/project membership.
- Produces: CRUD endpoints for clients/contacts/opportunities/project profiles and `transition_opportunity(opportunity, stage, actor)`.

- [ ] **Step 1: Write failing membership and transition tests**

Test that an active member can list only their workspace records, a UUID from another workspace returns 400/404, Guest cannot mutate, Admin/Member can mutate, stage transitions update probability only when explicitly provided, and conversion links one existing Plane Project through `SummonProjectProfile` without creating another project row.

- [ ] **Step 2: Run the focused test**

Run from `apps/api`: `pytest plane/tests/contract/summon/test_commercial_api.py -q`

Expected: endpoint reverse lookups fail.

- [ ] **Step 3: Implement one shared permission class**

```python
class SummonWorkspacePermission(BasePermission):
    def has_permission(self, request, view):
        roles = [20, 15] if request.method not in SAFE_METHODS else [20, 15, 5]
        return WorkspaceMember.objects.filter(
            workspace__slug=view.kwargs["slug"], member=request.user,
            role__in=roles, is_active=True,
        ).exists()
```

Use queryset filtering as a second boundary so object UUIDs cannot bypass workspace scope.

- [ ] **Step 4: Implement serializers and thin endpoints**

Expose `/api/summon/workspaces/<slug>/clients/`, `/opportunities/`, `/opportunities/<id>/transitions/`, and `/projects/<project_id>/profile/`. Validate all Client, User, Opportunity, and Project references against the URL workspace.

- [ ] **Step 5: Run commercial and Plane project regression tests**

Run from `apps/api`: `pytest plane/tests/contract/summon/test_commercial_api.py plane/tests/contract/api/test_projects.py -q`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add -- apps/api/plane/summon apps/api/plane/urls.py apps/api/plane/tests/contract/summon/test_commercial_api.py
git commit -m "feat(summon): add commercial workspace API"
```

---

### Task 4: Meetings, Page Context, and External Resources API

**Files:**

- Create: `apps/api/plane/summon/serializers/collaboration.py`
- Create: `apps/api/plane/summon/services/collaboration.py`
- Create: `apps/api/plane/summon/views/collaboration.py`
- Modify: `apps/api/plane/summon/urls.py`
- Test: `apps/api/plane/tests/contract/summon/test_collaboration_api.py`

**Interfaces:**

- Consumes: Plane `Issue`, `Page`, `FileAsset`, project access, and Task 3 permissions.
- Produces: Meeting CRUD, Issue-backed action links, Page context, and URL-only ResourceLink CRUD.

- [ ] **Step 1: Write failing canonical ownership tests**

Create a Plane Issue, link it to a Meeting, change the Issue state, and assert the Meeting response derives completion from the Issue. Test that MeetingWorkItem has no title/status/assignee/due-date fields. Test that file uploads are rejected by ResourceLink and that recording/transcript IDs must be accessible Plane FileAssets.

- [ ] **Step 2: Run the focused test**

Run from `apps/api`: `pytest plane/tests/contract/summon/test_collaboration_api.py -q`

Expected: serializers/routes are absent.

- [ ] **Step 3: Implement meeting and resource services**

`link_work_item(meeting, issue, actor)` must validate matching workspace and active project membership. `ResourceLink.url` must use Django URL validation and allow only `http`/`https`; `credential_id` is an optional reference and never serializes secret material.

- [ ] **Step 4: Add endpoints**

Expose `/meetings/`, `/meetings/<id>/work-items/`, `/page-contexts/`, and `/resources/`. Return nested Plane identifiers and labels, not copied work-item/page/file content.

- [ ] **Step 5: Run collaboration and Plane asset/page regression tests**

Run from `apps/api`: `pytest plane/tests/contract/summon/test_collaboration_api.py plane/tests/contract/app/test_page_version_project_scope_app.py plane/tests/contract/app/test_workspace_file_asset_project_scope_app.py -q`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add -- apps/api/plane/summon apps/api/plane/tests/contract/summon/test_collaboration_api.py
git commit -m "feat(summon): link meetings and resources to Plane records"
```

---

### Task 5: Deterministic Automation, Reports, and Assistant

**Files:**

- Create: `apps/api/plane/summon/serializers/operations.py`
- Create: `apps/api/plane/summon/services/automation.py`
- Create: `apps/api/plane/summon/services/reports.py`
- Create: `apps/api/plane/summon/services/assistant.py`
- Create: `apps/api/plane/summon/views/operations.py`
- Modify: `apps/api/plane/summon/urls.py`
- Test: `apps/api/plane/tests/contract/summon/test_operations_api.py`

**Interfaces:**

- Consumes: canonical Plane Issue/Page/FileAsset queries plus Summon records.
- Produces: synchronous deterministic job creation, computed reports, and authorized assistant answers.

- [ ] **Step 1: Write failing deterministic-output tests**

Freeze time, run the same template/context twice, and assert stable Markdown apart from generated timestamps. Assert a generated artifact points to exactly one Plane Page or FileAsset. Assert report totals equal direct canonical queries and an unauthorized project never appears in assistant output.

- [ ] **Step 2: Run the focused test**

Run from `apps/api`: `pytest plane/tests/contract/summon/test_operations_api.py -q`

Expected: operation services are absent.

- [ ] **Step 3: Implement synchronous automation using Plane outputs**

Implement templates for Proposal, Quotation, MoM, Presentation outline, Cost Projection, and POC Brief. Store template configuration and job status in Summon models; store rendered content in a Plane Page or FileAsset and only reference that target from `GeneratedArtifact`.

- [ ] **Step 4: Implement computed reports and assistant intents**

Support deterministic intents for portfolio status, overdue work items, client/opportunity pipeline, project summary, knowledge/page lookup, and automation history. Return a plain unsupported-intent response instead of inventing data. Every query begins from workspaces/projects visible to the current user.

- [ ] **Step 5: Add endpoints and run tests**

Expose `/automation/templates/`, `/automation/jobs/`, `/reports/summary/`, and `/assistant/query/`.

Run from `apps/api`: `pytest plane/tests/contract/summon/test_operations_api.py -q`

Expected: all tests pass and no Celery task is added for synchronous work.

- [ ] **Step 6: Commit**

```bash
git add -- apps/api/plane/summon apps/api/plane/tests/contract/summon/test_operations_api.py
git commit -m "feat(summon): add deterministic operations API"
```

---

### Task 6: Credential Vault Encryption, Grants, and Audit

**Files:**

- Create: `apps/api/plane/summon/serializers/credential.py`
- Create: `apps/api/plane/summon/services/credential.py`
- Create: `apps/api/plane/summon/views/credential.py`
- Modify: `apps/api/plane/summon/urls.py`
- Modify: `apps/api/plane/settings/common.py`
- Test: `apps/api/plane/tests/contract/summon/test_credential_api.py`

**Interfaces:**

- Consumes: installed `cryptography`, Plane password verification/session, active workspace membership, and explicit CredentialGrant.
- Produces: encrypted-at-rest credentials, masked list/detail, no-store reveal, rotation/grant/revoke/delete audit events.

- [ ] **Step 1: Write failing security tests**

Assert plaintext never appears in the database, list/detail responses, Python logs, or access history. Assert reveal fails without password re-verification or grant, cross-workspace grants fail, successful reveal has `Cache-Control: no-store`, rotation changes ciphertext, and every sensitive action creates an immutable log row.

- [ ] **Step 2: Run the focused security test**

Run from `apps/api`: `pytest plane/tests/contract/summon/test_credential_api.py -q`

Expected: vault endpoints are absent.

- [ ] **Step 3: Implement versioned encryption with the existing dependency**

Load `SUMMON_CREDENTIAL_KEY` only from runtime environment, decode one Fernet key, and prefix ciphertext with key version `v1:`. Fail startup checks in production when the key is absent or malformed. Never fall back to Django `SECRET_KEY`.

- [ ] **Step 4: Implement masked CRUD and sensitive actions**

List/detail return `••••••••` and metadata only. Reveal accepts the current password, confirms the grant/owner policy, appends an access log, and returns the secret once with no-store headers. Rotate, grant, revoke, and delete append audit records without embedding secret values.

- [ ] **Step 5: Run security and auth regression tests**

Run from `apps/api`: `pytest plane/tests/contract/summon/test_credential_api.py plane/tests/contract/api/test_authentication.py -q`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add -- apps/api/plane/summon apps/api/plane/settings/common.py apps/api/plane/tests/contract/summon/test_credential_api.py
git commit -m "feat(summon): add audited credential vault"
```

---

### Task 7: Frontend Contracts, Service, Routes, and Plane Navigation

**Files:**

- Create: `packages/types/src/summon/index.ts`
- Modify: `packages/types/src/index.ts`
- Create: `packages/constants/src/summon.ts`
- Modify: `packages/constants/src/index.ts`
- Create: `apps/web/core/services/summon.service.ts`
- Create: `apps/web/core/components/summon/page-shell.tsx`
- Create: `apps/web/core/components/summon/request-state.tsx`
- Create: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/layout.tsx`
- Modify: `apps/web/app/routes/extended.ts`
- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/extended-sidebar.tsx`

**Interfaces:**

- Consumes: Task 3-6 endpoint contracts and Plane `API_BASE_URL`, `APIService`, layout, permission, sidebar, and UI primitives.
- Produces: typed API methods and reachable workspace routes for every Summon module.

- [ ] **Step 1: Confirm the untouched frontend baseline**

Run: `pnpm --filter web check:types`

Expected: pass before adding the extension contracts.

- [ ] **Step 2: Add exact shared contracts and one HTTP service**

Define discriminated unions for opportunity stage, automation job status, resource type, and credential access action. Extend `APIService`; use one method per backend endpoint and return `response.data` using existing Plane error propagation.

- [ ] **Step 3: Add the route tree**

Register one `summon/layout.tsx` under the workspace project layout, with routes for home, clients, opportunities, reports, resources, meetings, automation, assistant, credentials, and settings. Link Tasks to Plane `/issues`, Knowledge to Plane `/pages`, Documents to the Plane asset/page surfaces, and Notifications to Plane `/notifications` rather than creating duplicate pages.

- [ ] **Step 4: Add Summon entries to Plane's extended sidebar**

Append typed items after Plane's native dynamic items, filtered through the same workspace permission helper. Reuse existing icons and `ExtendedSidebarItem`; do not add another sidebar component.

- [ ] **Step 5: Run checks and commit**

Run: `pnpm --filter web check:types && pnpm --filter web check:lint && git diff --check`

```bash
git add -- packages/types/src/summon packages/types/src/index.ts packages/constants/src/summon.ts packages/constants/src/index.ts apps/web/core/services/summon.service.ts apps/web/core/components/summon apps/web/app/routes/extended.ts 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/layout.tsx' 'apps/web/app/(all)/[workspaceSlug]/(projects)/extended-sidebar.tsx'
git commit -m "feat(summon): integrate routes and navigation into Plane"
```

---

### Task 8: Summon Screens and Canonical User Flows

**Files:**

- Create: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/page.tsx`
- Create: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/clients/page.tsx`
- Create: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/opportunities/page.tsx`
- Create: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/reports/page.tsx`
- Create: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/resources/page.tsx`
- Create: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/meetings/page.tsx`
- Create: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/automation/page.tsx`
- Create: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/assistant/page.tsx`
- Create: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/credentials/page.tsx`
- Create: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/settings/page.tsx`
- Create: `apps/web/core/components/summon/forms.tsx`
- Create: `apps/web/core/components/summon/credential-drawer.tsx`
- Modify: `apps/web/core/components/power-k/config/navigation/commands.ts`
- Modify: `apps/web/core/components/power-k/config/navigation/root.ts`
- Modify: `packages/i18n/src/locales/en/power-k.json`
- Test: `apps/web/e2e/summon/summon-core.spec.ts`

**Interfaces:**

- Consumes: Task 7 service/routes and native Plane project/work-item/page/file/notification links.
- Produces: every feature surface represented by the nine-page PDF without a second app shell.

- [ ] **Step 1: Write Playwright acceptance cases before page implementation**

Cover authenticated creation/read-back for Client and Opportunity; link a Plane Project profile; create Meeting and link a Plane Issue; create ResourceLink; run an automation and open its Plane Page/FileAsset; query Assistant; create/reveal/rotate a credential with masking; navigate to native Plane Tasks, Pages/Knowledge, Documents/assets, and Notifications.

- [ ] **Step 2: Verify the new routes fail before implementation**

Run the Playwright project against local Plane and expect 404/route failures for Summon paths while native Plane routes remain healthy.

- [ ] **Step 3: Build pages using Plane primitives**

Reuse `@plane/ui` buttons, inputs, modals, tables, cards, badges, skeletons, and empty states. Each action must call a persisted endpoint or a native Plane route. Add explicit loading, empty, validation, forbidden, not-found, conflict, and recoverable server-error states.

- [ ] **Step 4: Implement transient credential reveal behavior**

Keep the revealed secret only in component state. Clear it on drawer close, credential selection change, `visibilitychange` to hidden, and a 30-second timeout. Never copy it into MobX, localStorage, query cache, toast text, or screenshot fixtures.

- [ ] **Step 5: Add Summon commands to Plane Power-K**

Extend `usePowerKNavigationCommandsRecord` and its ordered list with navigation commands for Clients, Opportunities, Meetings, Automation, Assistant, Credentials, Reports, and Resources; add their English labels to the existing Power-K namespace. Reuse Plane's palette modal and keyboard handling.

- [ ] **Step 6: Run frontend checks and browser acceptance**

Run: `pnpm --filter web check:types && pnpm --filter web check:lint && pnpm --filter web build`

Run: `pnpm exec playwright test apps/web/e2e/summon/summon-core.spec.ts`

Expected: desktop and mobile projects pass with no page errors or console errors.

- [ ] **Step 7: Commit**

```bash
git add -- 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon' apps/web/core/components/summon apps/web/core/components/power-k/config/navigation/commands.ts apps/web/core/components/power-k/config/navigation/root.ts packages/i18n/src/locales/en/power-k.json apps/web/e2e/summon/summon-core.spec.ts
git commit -m "feat(summon): deliver core workspace flows"
```

---

### Task 9: Production Compose Contract and Release Evidence

**Files:**

- Create: `deployments/summon/docker-compose.yml`
- Create: `deployments/summon/.env.example`
- Create: `deployments/summon/README.md`
- Modify: `.github/workflows/build-branch.yml` only if the existing deployment requires a repository workflow trigger.
- Test: `scripts/check-summon-deployment.sh`

**Interfaces:**

- Consumes: Plane services/images, the fork commit SHA, production hostname, PostgreSQL, Redis, object storage, mail/auth settings, and runtime-only Summon credential key.
- Produces: one deployable stack with web, API, worker/beat, database dependencies, migration command, health checks, and SHA evidence.

- [ ] **Step 1: Inspect the live deployment provider before writing configuration**

Resolve the current domain, deployment resource, build source, environment names, volumes, and database backup path. Record only non-secret names and resource IDs in `deployments/summon/README.md`.

- [ ] **Step 2: Add the smallest production override**

Reuse Plane's official Compose services and images/build contexts. Override hostname, product metadata, source commit, persistent volume names, and `SUMMON_CREDENTIAL_KEY` requirement. Do not duplicate the full upstream Compose file when an override is sufficient.

- [ ] **Step 3: Write and run deployment validation**

`scripts/check-summon-deployment.sh` must run `docker compose -f docker-compose.yml -f deployments/summon/docker-compose.yml config`, reject unresolved `${...}` values required at runtime, and confirm only Plane web/API/worker services expose application traffic.

- [ ] **Step 4: Run the full local release gate**

Run:

```bash
sh scripts/check-summon-boundaries.sh
sh scripts/check-summon-deployment.sh
pnpm check
pnpm build
docker compose -f docker-compose-test.yml up --build --abort-on-container-exit --exit-code-from api-tests
git diff --check
```

Expected: every command exits 0; the custom Django migration applies from an empty database.

- [ ] **Step 5: Commit and publish the feature branch**

```bash
git add -- deployments/summon scripts/check-summon-deployment.sh .github/workflows/build-branch.yml
git commit -m "ops(summon): add Plane production deployment contract"
git push -u origin feat/summon-core-migration
```

- [ ] **Step 6: Create a reviewable pull request and verify CI**

Create one draft PR from `withsummon:feat/summon-core-migration` to `withsummon:main`, inspect every changed path and CI result, then mark ready and merge only after all required checks pass.

---

### Task 10: Production Cutover, UAT, and Legacy Retirement

**Files:**

- Create: `docs/releases/2026-08-21-production-uat.md`
- Modify: deployment provider state for `summon-core.withsummon.com` after a backup and rollback target are confirmed.
- Delete: `withsummon/summon-core-system-legacy` only after every gate below is evidenced and no deployment points to it.

**Interfaces:**

- Consumes: merged `main`, passing CI, a production backup, deployment credentials, and DNS/TLS access.
- Produces: live Plane fork with Summon flows, proof of the deployed SHA, and removal of the unused legacy repository/runtime.

- [ ] **Step 1: Capture rollback evidence**

Record the current legacy deployment ID, image/build SHA, database backup timestamp, object-storage bucket/volume, and previous routing target in the private deployment system. Do not put secrets in the repository.

- [ ] **Step 2: Deploy the merged fork**

Point the production resource at `withsummon/summon-core-system:main`, inject runtime secrets, run Django migrations once, start Plane services, and wait for API and web health checks to converge.

- [ ] **Step 3: Verify deployed identity**

Confirm GitHub remote SHA equals the build/deployment SHA and that `https://summon-core.withsummon.com/` no longer returns Next.js headers or the old shell. Record timestamps, SHA, and redacted provider evidence in `docs/releases/2026-08-21-production-uat.md`.

- [ ] **Step 4: Run authenticated production UAT**

In a disposable UAT workspace, complete sign-in, workspace creation, Plane Project/Issue/Page/FileAsset flows, Client/Opportunity/Profile, ResourceLink, Meeting/Issue action, Automation artifact, Reports, Assistant, Credential masking/reveal/rotation/audit, native Notification, refresh read-back, file download, and mobile navigation. Record result and non-secret screenshot paths.

- [ ] **Step 5: Audit live dependencies before legacy removal**

Search deployment source settings, webhooks, DNS, CI secrets names, and running containers for `summon-core-system-legacy` and the old Next.js runtime. The result must be empty except historical release evidence. Confirm rollback now targets the prior Plane deployment or database backup, not the legacy repository.

- [ ] **Step 6: Remove legacy runtime and repository**

Stop/delete the old Next.js deployment resource, then delete `withsummon/summon-core-system-legacy` through GitHub only after Step 5 passes. Remove the local legacy checkout by moving it to Trash, not recursive deletion, and state whether recovery remains possible.

- [ ] **Step 7: Re-run public smoke and close the goal**

Verify homepage, auth redirect, API health, one authenticated persisted read-back, TLS, browser console, and mobile viewport after legacy removal. Mark the goal complete only when the live SHA and all UAT checks remain green.

---

## Self-Review Result

- Spec coverage: repository fork, stable baseline, all nine PDF feature groups, canonical ownership, permissions, credentials, tests, deployment, UAT, and conditional legacy removal each map to a task.
- Placeholder scan: no deferred implementation instruction is used; every task names concrete files, commands, expected outcomes, and security boundaries.
- Type consistency: backend and frontend use the same model names, route prefix `/api/summon/workspaces/<slug>/`, and Plane UUID references throughout.
- Scope split: each subsystem is an independently testable commit; no task requires a second runtime or duplicate canonical model.
