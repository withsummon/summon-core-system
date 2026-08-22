# Summon Commercial and Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the PDF client, opportunity, meeting, credential, settings, and Power-K workflows with real persistence and canonical Plane links.

**Architecture:** Extend the existing Summon CRUD services and serializers only where detail screens need data or actions. Keep issue/page/file editing in Plane, reuse the encrypted Credential Vault, and expose PDF compositions as dedicated direct-reloadable routes.

**Tech Stack:** Django 5, Django REST Framework, PostgreSQL, React 19, React Router 7, TypeScript, SWR, Plane UI/Propel.

**Spec:** `docs/superpowers/specs/2026-08-22-summon-core-pdf-gap-closure-design.md`

## Global Constraints

- Client, Contact, Opportunity, Project Profile, Meeting, ResourceLink, and Credential records remain workspace-scoped Summon records.
- Project, Issue, Page, FileAsset, User, and membership records remain canonical Plane records referenced by UUID.
- Guest writes remain rejected; Admin/Member writes remain permission-filtered.
- Credential secrets stay encrypted, masked in ordinary responses, and protected by password confirmation plus immutable audit.
- Meeting automatic speech-to-text is outside scope; users supply transcript text or an accessible text FileAsset.

---

### Task 1: Client and Opportunity detail contracts

**Files:**

- Modify: `apps/api/plane/summon/serializers/commercial.py`
- Modify: `apps/api/plane/summon/views/commercial.py`
- Modify: `apps/api/plane/summon/services/commercial.py`
- Modify: `apps/api/plane/tests/contract/summon/test_commercial_api.py`
- Modify: `packages/types/src/summon/index.ts`
- Modify: `apps/web/core/services/summon.service.ts`

**Interfaces:**

- Consumes: existing Client/Contact/Opportunity/ProjectProfile CRUD and Plane Page/Project/Issue permission filters.
- Produces: nested authorized detail payloads and the existing stage-transition action with read-back data.

- [ ] **Step 1: Write failing detail-scope tests**

```python
@pytest.mark.django_db
def test_client_detail_contains_only_linked_visible_projects(session_client, workspace, create_user):
    client = Client.objects.create(workspace=workspace, name="Acme")
    visible = Project.objects.create(workspace=workspace, name="Visible", identifier="VIS")
    ProjectMember.objects.create(workspace=workspace, project=visible, member=create_user, role=20)
    hidden = Project.objects.create(workspace=workspace, name="Hidden", identifier="HID")
    SummonProjectProfile.objects.create(workspace=workspace, project=visible, client=client)
    SummonProjectProfile.objects.create(workspace=workspace, project=hidden, client=client)
    response = session_client.get(f"/api/summon/workspaces/{workspace.slug}/clients/{client.id}/")
    assert [item["id"] for item in response.data["projects"]] == [str(visible.id)]


@pytest.mark.django_db
def test_opportunity_transition_survives_read_back(session_client, workspace):
    opportunity = Opportunity.objects.create(workspace=workspace, title="Renewal")
    url = f"/api/summon/workspaces/{workspace.slug}/opportunities/{opportunity.id}/transitions/"
    assert session_client.post(url, {"stage": "proposal", "probability": 60}, format="json").status_code == 200
    detail = session_client.get(f"/api/summon/workspaces/{workspace.slug}/opportunities/{opportunity.id}/")
    assert (detail.data["stage"], detail.data["probability"]) == ("proposal", 60)
```

- [ ] **Step 2: Run focused tests and verify failure**

Run from `apps/api`: `pytest plane/tests/contract/summon/test_commercial_api.py -q`

Expected: FAIL because current detail serializers do not expose the required authorized relationship groups.

- [ ] **Step 3: Add detail-only derived fields**

```python
def visible_linked_projects(client, user):
    ids = visible_project_ids(client.workspace, user)
    return Project.objects.filter(id__in=ids, summon_profile__client=client).values("id", "identifier", "name")
```

Return contacts, opportunities, visible projects, meetings, Page contexts, and recent activity on client detail. Return client/contact context, visible project profile, meetings, Page contexts, and linked work items on opportunity detail. Do not copy related records into new columns.

- [ ] **Step 4: Add exact frontend contract fields**

```ts
export interface ISummonClientDetail extends ISummonClient {
  contacts: ISummonClientContact[];
  opportunities: ISummonOpportunity[];
  projects: Array<{ id: string; identifier: string; name: string }>;
  meetings: ISummonMeeting[];
  page_contexts: ISummonPageContext[];
}
```

Add `getClientDetail()` and `getOpportunityDetail()` methods while preserving current list and CRUD methods.

- [ ] **Step 5: Run contract and type checks**

Run from `apps/api`: `pytest plane/tests/contract/summon/test_commercial_api.py -q`

Run from root: `pnpm --filter @plane/types check:types && pnpm --filter web check:types`

Expected: PASS, including cross-workspace and Guest mutation cases.

- [ ] **Step 6: Commit detail contracts**

```bash
git add -- apps/api/plane/summon apps/api/plane/tests/contract/summon/test_commercial_api.py packages/types/src/summon/index.ts apps/web/core/services/summon.service.ts
git commit -m "feat(summon): expose authorized commercial details"
```

---

### Task 2: Client profile and Opportunity pipeline/detail UI

**Files:**

- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/clients/page.tsx`
- Create: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/clients/[clientId]/page.tsx`
- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/opportunities/page.tsx`
- Create: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/opportunities/[opportunityId]/page.tsx`
- Create: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/commercial-routes.test.ts`

**Interfaces:**

- Consumes: Task 1 detail contracts and current create/update/transition service methods.
- Produces: searchable list/pipeline screens and persistent client/opportunity detail routes.

- [ ] **Step 1: Write the failing route and mutation guard**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Opportunity detail uses the transition endpoint and read-back mutation", () => {
  const source = readFileSync(new URL("./opportunities/[opportunityId]/page.tsx", import.meta.url), "utf8");
  assert.match(source, /transitionOpportunity/);
  assert.match(source, /mutate/);
});
```

- [ ] **Step 2: Run the test and verify missing route failure**

Run: `node --test 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/commercial-routes.test.ts'`

Expected: FAIL because the detail routes are absent.

- [ ] **Step 3: Implement the PDF management and profile compositions**

```tsx
const { data, error, isLoading, mutate } = useSWR(["summon-client", workspaceSlug, clientId], () =>
  summonService.getClientDetail(workspaceSlug, clientId)
);
if (!data) return <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />;
```

Client detail renders identity/actions, contacts, pipeline, linked projects, Pages, meetings, notes, and recent activity. Opportunity list renders stage columns or compact table by viewport; detail renders client/contact, probability/value/dates, linked project/work, meetings, Pages, and explicit generation actions that navigate to Automation with context query parameters.

- [ ] **Step 4: Verify persistence and direct routes**

Run: `node --test 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/commercial-routes.test.ts' && pnpm --filter web check:types && pnpm --filter web check:format`

Expected: PASS. Browser flow creates a client/contact/opportunity, transitions the stage, reloads both detail routes, and reads the saved values back with zero console errors.

- [ ] **Step 5: Commit commercial UI**

```bash
git add -- 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/clients' 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/opportunities' 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/commercial-routes.test.ts'
git commit -m "feat(summon): complete commercial workspace UI"
```

---

### Task 3: Meeting detail and transcript association before AI

**Files:**

- Modify: `apps/api/plane/summon/serializers/collaboration.py`
- Modify: `apps/api/plane/summon/views/collaboration.py`
- Modify: `apps/api/plane/summon/urls.py`
- Modify: `apps/api/plane/tests/contract/summon/test_collaboration_api.py`
- Modify: `packages/types/src/summon/index.ts`
- Modify: `apps/web/core/services/summon.service.ts`
- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/meetings/page.tsx`
- Create: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/meetings/[meetingId]/page.tsx`

**Interfaces:**

- Consumes: existing Meeting CRUD, MeetingParticipant, MeetingWorkItem, Plane FileAsset, Plane Issue, and project access checks.
- Produces: participant and transcript/recording association actions; AI summary action is added only in the next plan.

- [ ] **Step 1: Write failing association tests**

```python
@pytest.mark.django_db
def test_meeting_rejects_transcript_asset_from_another_workspace(workspace):
    actor, api = authenticated_user(workspace)
    foreign_workspace = Workspace.objects.create(name="Foreign", slug=f"foreign-{uuid4().hex}", owner=actor)
    meeting = Meeting.objects.create(workspace=workspace, title="Review", starts_at=timezone.now())
    asset = FileAsset.objects.create(workspace=foreign_workspace, user=actor, asset=f"{foreign_workspace.id}/transcript.txt", attributes={"name": "transcript.txt"}, is_uploaded=True)
    response = api.patch(
        f"/api/summon/workspaces/{workspace.slug}/meetings/{meeting.id}/",
        {"transcript_asset": str(asset.id)},
        format="json",
    )
    assert response.status_code == 400
```

- [ ] **Step 2: Run collaboration tests and verify the missing behavior**

Run from `apps/api`: `pytest plane/tests/contract/summon/test_collaboration_api.py -q`

Expected: the new transcript and participant mutation cases fail.

- [ ] **Step 3: Add explicit association actions**

```python
class MeetingParticipantView(WorkspaceContextMixin, BaseAPIView):
    def post(self, request, slug, meeting_id):
        meeting = get_object_or_404(Meeting, workspace=self.workspace, id=meeting_id)
        serializer = MeetingParticipantSerializer(data=request.data, context={"meeting": meeting, "request": request})
        serializer.is_valid(raise_exception=True)
        return Response(MeetingParticipantSerializer(serializer.save()).data, status=201)
```

Validate member, Issue, recording asset, transcript text asset, summary Page, and project references against the URL workspace and project access. Plain transcript text is stored in the meeting's linked summary Page draft, not a new transcript model.

- [ ] **Step 4: Implement the PDF meeting workspace**

```tsx
const {
  data: meeting,
  error,
  isLoading,
  mutate,
} = useSWR(["summon-meeting", workspaceSlug, meetingId], () => summonService.getMeeting(workspaceSlug, meetingId));
if (!meeting) return <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />;
```

Render recording player/link, supplied transcript, participants, decisions/notes, related Pages, and Plane action items. Every work-item row links to native Plane Issue detail. Do not render a summary-generation action until Plan 4 connects it to the real provider boundary.

- [ ] **Step 5: Run checks and reload proof**

Run from `apps/api`: `pytest plane/tests/contract/summon/test_collaboration_api.py -q`

Run from root: `pnpm --filter @plane/types check:types && pnpm --filter web check:types && pnpm --filter web check:format`

Expected: PASS. Browser creates a meeting, links a transcript FileAsset and Issue, reloads detail, and reads both back.

- [ ] **Step 6: Commit meeting workspace foundation**

```bash
git add -- apps/api/plane/summon apps/api/plane/tests/contract/summon/test_collaboration_api.py packages/types/src/summon/index.ts apps/web/core/services/summon.service.ts 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/meetings'
git commit -m "feat(summon): complete meeting workspace associations"
```

---

### Task 4: Credential Vault, Settings, and Power-K completion

**Files:**

- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/credentials/page.tsx`
- Modify: `apps/web/core/components/summon/credential-drawer.tsx`
- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/settings/page.tsx`
- Modify: `apps/web/core/components/power-k/config/navigation/commands.ts`
- Modify: `apps/web/core/components/power-k/config/navigation/root.ts`
- Modify: `apps/web/core/components/power-k/config/creation/command.ts`
- Modify: `apps/web/core/components/power-k/config/creation/root.ts`
- Create: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/operations-ui.test.ts`

**Interfaces:**

- Consumes: existing encrypted credential create/reveal/rotate/grant/revoke/audit API, native Plane Settings links, and Power-K registry.
- Produces: complete PDF Credential Vault/settings screens and additive Summon commands without removing native commands.

- [ ] **Step 1: Write failing Power-K and secret-display guards**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Power-K retains native commands and adds Summon destinations", () => {
  const source = readFileSync("apps/web/core/components/power-k/config/navigation/commands.ts", "utf8");
  assert.match(source, /summon.*tasks/s);
  assert.match(source, /workspace-views/);
});

test("Credential list never renders secret ciphertext", () => {
  const source = readFileSync(new URL("./credentials/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /secret_ciphertext/);
});
```

- [ ] **Step 2: Run the tests and verify missing Summon command coverage**

Run: `node --test 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/operations-ui.test.ts'`

Expected: FAIL because Power-K lacks the complete Summon route set.

- [ ] **Step 3: Finish Credential Vault and Settings compositions**

Credential Vault renders status metrics, searchable/filterable table, create form, detail drawer, masked list values, password-confirmed reveal/rotate, grants, revoke, and immutable audit. Settings renders Summon overview and links to canonical workspace/profile/project/security/notification settings. It shows only `Configured`/`Not configured`, provider label, and model for AI; credential entry stays in the instance-admin application.

```tsx
<Link
  href={`/${workspaceSlug}/settings`}
  className="rounded-xl border border-subtle p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-primary"
>
  Open Plane workspace settings
</Link>
```

- [ ] **Step 4: Add Summon navigation and creation commands additively**

```ts
summonTasks: {
  key: "summonTasks",
  title: "Open Summon Task Center",
  action: (ctx) => handlePowerKNavigate(ctx, [ctx.params.workspaceSlug?.toString(), "summon", "tasks"]),
  shouldRender: baseWorkspaceConditions,
},
```

Add Home, Projects, Opportunities, Clients, Tasks, Documents, Knowledge, Resources, Automation Studio, Credentials, Reports, Notifications, Settings, and Assistant navigation. Add create client/opportunity/meeting and open Automation actions using existing route/query parameters. Do not alter or filter native commands.

- [ ] **Step 5: Verify security-sensitive flows and native commands**

Run: `node --test 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/operations-ui.test.ts' && pnpm --filter web check:types && pnpm --filter web check:format && pnpm --filter web build`

Expected: PASS. Browser verifies create/reveal/rotate/grant/revoke/read-back, sanitized errors, Settings links, a native create-work-item command, and each Summon command with zero console errors.

- [ ] **Step 6: Run backend credential regression and commit**

Run from `apps/api`: `pytest plane/tests/contract/summon/test_credential_api.py -q`

Expected: PASS.

```bash
git add -- 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/credentials' 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/settings' 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/operations-ui.test.ts' apps/web/core/components/summon/credential-drawer.tsx apps/web/core/components/power-k/config
git commit -m "feat(summon): complete operations and security UI"
```

---

### Task 5: Commercial and operations acceptance

**Files:**

- Review: all files changed by Tasks 1 through 4.

**Interfaces:**

- Consumes: completed commercial, meeting, credential, settings, and command flows.
- Produces: verified persisted workflows and PDF screenshots.

- [ ] **Step 1: Run all focused tests and build**

Run from `apps/api`: `pytest plane/tests/contract/summon/test_commercial_api.py plane/tests/contract/summon/test_collaboration_api.py plane/tests/contract/summon/test_credential_api.py -q`

Run from root: `node --test 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/'*.test.ts && pnpm --filter @plane/types check:types && pnpm --filter web check:types && pnpm --filter web check:format && pnpm --filter web build && git diff --check`

Expected: every command exits 0.

- [ ] **Step 2: Capture browser acceptance**

Capture Client profile, Opportunities, Meeting Workspace, Credential Vault, Settings, and Power-K at 1440 by 900 plus the corresponding functional mobile screens at 390 by 844 under `output/playwright/summon-commercial-operations/`. Store a separate zero-error console log for each route.

- [ ] **Step 3: Confirm read-back and ownership**

Reload every created detail route, verify saved values, open linked Plane Project/Issue/Page/FileAsset records, and confirm no duplicated canonical rows appear in the Summon model allowlist.
