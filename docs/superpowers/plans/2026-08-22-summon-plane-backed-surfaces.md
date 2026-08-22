# Summon Plane-Backed Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver functional PDF-faithful Home, Project Overview, Task Center, Documents, Knowledge, Resources, and Notifications over canonical Plane records.

**Architecture:** Add two permission-filtered Django aggregate reads for Home and Project Overview. Build all index screens from existing Plane APIs/stores and Summon resource/page-context APIs; mutations and detailed editing continue on native Plane routes.

**Tech Stack:** Django 5, Django REST Framework, React 19, React Router 7, TypeScript, MobX, SWR, Tailwind CSS 4, Plane UI/Propel.

**Spec:** `docs/superpowers/specs/2026-08-22-summon-core-pdf-gap-closure-design.md`

## Global Constraints

- Plane remains canonical for Project, Issue, Page, FileAsset, Notification, User, Workspace, Cycle, and Module records.
- Do not add Summon project, task, document, page, file, or notification models.
- Every aggregate filters through the requesting member's active workspace and project access.
- Native Plane detail/editing routes remain the final editing surfaces.
- Add no chart dependency and no production sample records.

---

### Task 1: Permission-filtered Home and Project Overview aggregates

**Files:**

- Create: `apps/api/plane/summon/services/overview.py`
- Create: `apps/api/plane/summon/views/overview.py`
- Modify: `apps/api/plane/summon/views/__init__.py`
- Modify: `apps/api/plane/summon/urls.py`
- Modify: `packages/types/src/summon/index.ts`
- Modify: `apps/web/core/services/summon.service.ts`
- Create: `apps/api/plane/tests/contract/summon/test_overview_api.py`

**Interfaces:**

- Consumes: `visible_project_ids(workspace, user)`, Plane Project/Issue/Page/ProjectMember/Cycle/Module/activity records, and Summon Meeting/ResourceLink/SummonProjectProfile.
- Produces: `GET /api/summon/workspaces/<slug>/home/summary/`, `GET /api/summon/workspaces/<slug>/projects/<uuid:project_id>/overview/`, `ISummonHomeSummary`, and `ISummonProjectOverview`.

- [ ] **Step 1: Write failing access and aggregate tests**

```python
@pytest.mark.django_db
def test_home_summary_excludes_projects_without_membership(session_client, workspace, create_user):
    visible, _, _ = create_project(workspace, create_user, "VIS")
    Project.objects.create(workspace=workspace, name="Hidden", identifier="HID")
    response = session_client.get(f"/api/summon/workspaces/{workspace.slug}/home/summary/")
    assert response.status_code == 200
    assert [item["id"] for item in response.data["projects"]] == [str(visible.id)]


@pytest.mark.django_db
def test_project_overview_rejects_an_inaccessible_project(session_client, workspace):
    hidden = Project.objects.create(workspace=workspace, name="Hidden", identifier="HID")
    response = session_client.get(f"/api/summon/workspaces/{workspace.slug}/projects/{hidden.id}/overview/")
    assert response.status_code == 404
```

- [ ] **Step 2: Run the tests and verify route failure**

Run from `apps/api`: `pytest plane/tests/contract/summon/test_overview_api.py -q`

Expected: FAIL with route not found.

- [ ] **Step 3: Implement one shared aggregate query boundary**

```python
def accessible_project(workspace, user, project_id):
    return (
        Project.objects.filter(workspace=workspace, id=project_id, id__in=visible_project_ids(workspace, user))
        .select_related("workspace")
        .first()
    )


def completion_counts(issues):
    return issues.aggregate(
        total=Count("id"),
        completed=Count("id", filter=Q(state__group="completed")),
        overdue=Count("id", filter=Q(target_date__lt=timezone.now().date()) & ~Q(state__group__in=["completed", "cancelled"])),
    )
```

`home_summary(workspace, user)` returns priority work items, project health/counts, recent authorized activity, upcoming meetings, resources, and aggregate counts. `project_overview(workspace, user, project_id)` returns project/profile identity, progress, milestones from Modules/Cycles, recent Issues, Pages, meetings, resources, activity, and native route IDs.

- [ ] **Step 4: Expose thin endpoints and matching TypeScript contracts**

```python
class HomeSummaryView(WorkspaceContextMixin, BaseAPIView):
    def get(self, request, slug):
        return Response(home_summary(self.workspace, request.user))


class ProjectOverviewView(WorkspaceContextMixin, BaseAPIView):
    def get(self, request, slug, project_id):
        data = project_overview(self.workspace, request.user, project_id)
        if data is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(data)
```

```ts
export interface ISummonHomeSummary {
  priority: ISummonIssueSnapshot[];
  projects: Array<{ id: string; identifier: string; name: string; health: string; completion: number }>;
  counts: { projects: number; issues: number; clients: number; opportunities: number };
  recent_activity: Array<{ id: string; label: string; created_at: string; href: string }>;
  upcoming_meetings: ISummonMeeting[];
  resources: ISummonResourceLink[];
}

export interface ISummonProjectOverview {
  project: { id: string; identifier: string; name: string; description: string };
  profile: ISummonProjectProfile | null;
  progress: { total: number; completed: number; overdue: number; percentage: number };
  milestones: Array<{ id: string; name: string; target_date: string | null; completion: number; href: string }>;
  issues: ISummonIssueSnapshot[];
  pages: Array<{ id: string; name: string; href: string }>;
  meetings: ISummonMeeting[];
  resources: ISummonResourceLink[];
  activity: Array<{ id: string; label: string; created_at: string; href: string }>;
}

getHomeSummary(workspaceSlug: string) {
  return this.data<ISummonHomeSummary>(this.get(`${this.root(workspaceSlug)}/home/summary/`));
}

getProjectOverview(workspaceSlug: string, projectId: string) {
  return this.data<ISummonProjectOverview>(this.get(`${this.root(workspaceSlug)}/projects/${projectId}/overview/`));
}
```

- [ ] **Step 5: Run focused backend and frontend checks**

Run from `apps/api`: `pytest plane/tests/contract/summon/test_overview_api.py plane/tests/contract/summon/test_operations_api.py -q`

Run from repository root: `pnpm --filter @plane/types check:types && pnpm --filter web check:types`

Expected: PASS; query-count assertions remain bounded when more Issues/Pages are added.

- [ ] **Step 6: Commit aggregate contracts**

```bash
git add -- apps/api/plane/summon apps/api/plane/tests/contract/summon/test_overview_api.py packages/types/src/summon/index.ts apps/web/core/services/summon.service.ts
git commit -m "feat(summon): add authorized home and project aggregates"
```

---

### Task 2: PDF page-6 Home and pages-1/2 Projects/Project Overview

**Files:**

- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/page.tsx`
- Create: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/projects/page.tsx`
- Create: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/projects/[projectId]/page.tsx`
- Create: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/projects/[projectId]/project-overview.test.ts`
- Modify: `apps/web/core/components/summon/screen.tsx`
- Modify: `apps/web/core/components/summon/progress.tsx`

**Interfaces:**

- Consumes: `summonService.getHomeSummary()` and `summonService.getProjectOverview()` from Task 1.
- Produces: direct-reloadable Home, Projects index, and Project Overview routes with native Plane deep links.

- [ ] **Step 1: Write a failing route-source test**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Project Overview loads its dedicated aggregate and links to native Issues and Pages", () => {
  const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
  assert.match(source, /getProjectOverview/);
  assert.match(source, /\/issues\//);
  assert.match(source, /\/pages\//);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/projects/[projectId]/project-overview.test.ts'`

Expected: FAIL because the route is absent.

- [ ] **Step 3: Replace Home's three-request composition with the Home aggregate**

```tsx
const { data, error, isLoading, mutate } = useSWR(["summon-home", workspaceSlug], () =>
  summonService.getHomeSummary(workspaceSlug)
);
if (!data) return <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />;
```

Render PDF page 6 sections from live fields: priority, company snapshot, active project health, activity, quick access, upcoming meetings, and calendar. Each project card links to `/${workspaceSlug}/summon/projects/${project.id}/`. The Projects index uses the same authorized project summaries with search/health filters and links each row/card to the detail route.

- [ ] **Step 4: Implement Project Overview tabs without duplicate editors**

```tsx
const tabs = [
  ["Overview", `/${workspaceSlug}/summon/projects/${projectId}/`],
  ["Tasks", `/${workspaceSlug}/projects/${projectId}/issues/`],
  ["Milestones", `/${workspaceSlug}/projects/${projectId}/modules/`],
  ["Documents", `/${workspaceSlug}/projects/${projectId}/pages/`],
] as const;
```

The Overview tab renders progress, delivery/commercial profile, milestones, issues, Pages, resources, meetings, and activity. Repositories/Deployments filter project ResourceLinks; Notes/More link to the nearest canonical Plane Page/project settings surfaces.

- [ ] **Step 5: Verify route behavior and responsiveness**

Run: `node --test 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/projects/[projectId]/project-overview.test.ts' && pnpm --filter web check:types && pnpm --filter web check:format`

Expected: PASS. In the browser, click Home to Project Overview, open native Tasks and Documents tabs, go back, reload the detail URL, and confirm the same project remains selected with zero console errors.

- [ ] **Step 6: Commit the primary compositions**

```bash
git add -- 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/page.tsx' 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/projects' apps/web/core/components/summon
git commit -m "feat(summon): implement home and project overview"
```

---

### Task 3: Plane-backed Task, Document, Knowledge, Resource, and Notification indexes

**Files:**

- Create: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/tasks/page.tsx`
- Create: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/documents/page.tsx`
- Create: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/knowledge/page.tsx`
- Create: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/notifications/page.tsx`
- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/resources/page.tsx`
- Create: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/plane-backed-routes.test.ts`
- Modify: `packages/constants/src/summon.ts`
- Modify: `packages/i18n/src/locales/en/common.json`
- Modify: `apps/web/core/components/workspace/sidebar/sidebar-menu-items.tsx`
- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/extended-sidebar.tsx`

**Interfaces:**

- Consumes: existing Plane Issue/Page/FileAsset/Notification services and stores, `summonService.listPageContexts()`, and `summonService.listResources()`.
- Produces: PDF-style read/index routes; writes continue through native Plane routes or existing Summon ResourceLink actions.

- [ ] **Step 1: Write the failing ownership and navigation guard**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

for (const route of ["projects", "tasks", "documents", "knowledge", "notifications"]) {
  test(`${route} route does not create a parallel domain`, () => {
    const source = readFileSync(new URL(`./${route}/page.tsx`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /createSummon(Task|Document|Page|Notification)/);
  });
}
```

- [ ] **Step 2: Run the test and verify missing routes**

Run: `node --test 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/plane-backed-routes.test.ts'`

Expected: FAIL because the route files are absent.

- [ ] **Step 3: Implement Task Center over Plane Issues**

Use the established Issue store/service for accessible projects, group records by overdue/today/upcoming, and link to native issue detail.

```tsx
<Link
  href={`/${workspaceSlug}/projects/${issue.project_id}/issues/${issue.id}/`}
  className="block rounded-xl border border-subtle p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-primary"
>
  <span className="text-xs font-medium text-primary">{issue.name}</span>
</Link>
```

- [ ] **Step 4: Implement Documents over Plane Pages and FileAssets**

Index only Pages/FileAssets already returned by Plane permission-filtered services. Use their native links and do not add upload/edit actions outside Plane.

```tsx
<Link
  href={`/${workspaceSlug}/projects/${page.project_id}/pages/${page.id}/`}
  className="text-sm font-medium text-primary hover:text-accent-primary"
>
  {page.name}
</Link>
```

- [ ] **Step 5: Implement Knowledge over Pages plus SummonPageContext**

Join PageContext metadata to accessible Page IDs in the browser, then provide category/tag/search filters. Never render a context whose Page is absent from the authorized Plane result.

```ts
const visibleContexts = contexts.filter((context) => accessiblePageIds.has(context.page));
```

- [ ] **Step 6: Complete Resources over ResourceLinks and canonical targets**

Keep current ResourceLink CRUD, add project/category/search filters, and render linked Page/FileAsset metadata. Route uploads to Plane.

```tsx
const target = resource.page ? `/${workspaceSlug}/projects/${resource.project}/pages/${resource.page}/` : resource.url;
```

- [ ] **Step 7: Implement Notifications over the native feed**

Use the existing workspace-notification store and link notification mutations/preferences to native Inbox and Settings.

```tsx
<Link href={`/${workspaceSlug}/notifications/`} className="text-xs font-medium text-accent-primary">
  Open Plane Inbox
</Link>
```

- [ ] **Step 8: Add the final PDF-ordered sidebar entries once routes exist**

```ts
export const SUMMON_MODULES = [
  { key: "summon", label: "Home", path: "" },
  { key: "summon_projects", label: "Projects", path: "projects" },
  { key: "summon_opportunities", label: "Opportunities", path: "opportunities" },
  { key: "summon_clients", label: "Clients", path: "clients" },
  { key: "summon_tasks", label: "Tasks", path: "tasks" },
  { key: "summon_documents", label: "Documents", path: "documents" },
  { key: "summon_knowledge", label: "Knowledge", path: "knowledge" },
  { key: "summon_resources", label: "Resources", path: "resources" },
  { key: "summon_automation", label: "Automation Studio", path: "automation" },
  { key: "summon_credentials", label: "Credentials", path: "credentials" },
  { key: "summon_reports", label: "Reports", path: "reports" },
  { key: "summon_notifications", label: "Notifications", path: "notifications" },
  { key: "summon_settings", label: "Settings", path: "settings" },
] as const;
```

Keep Assistant as a distinct bottom action in `sidebar-menu-items.tsx`, and ensure the extended menu excludes all Summon keys.

- [ ] **Step 9: Run tests and click every new route**

Run: `node --test 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/plane-backed-routes.test.ts' && pnpm --filter @plane/constants check:types && pnpm --filter web check:types && pnpm --filter web check:format`

Expected: PASS. Browser clicks cover every new sidebar item, direct reload, search/filter, native edit deep link, sidebar collapse/expand, and mobile drawer with zero console errors.

- [ ] **Step 10: Commit the Plane-backed routes**

```bash
git add -- 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon' packages/constants/src/summon.ts packages/i18n/src/locales/en/common.json apps/web/core/components/workspace/sidebar/sidebar-menu-items.tsx 'apps/web/app/(all)/[workspaceSlug]/(projects)/extended-sidebar.tsx'
git commit -m "feat(summon): add Plane-backed workspace surfaces"
```

---

### Task 4: Plane-backed surface acceptance

**Files:**

- Review: all files changed by Tasks 1 through 3.

**Interfaces:**

- Consumes: completed Home, Project Overview, index routes, and navigation.
- Produces: accepted PDF screens with canonical ownership preserved.

- [ ] **Step 1: Run all focused tests and build**

Run from `apps/api`: `pytest plane/tests/contract/summon/test_overview_api.py plane/tests/contract/summon/test_operations_api.py plane/tests/contract/summon/test_collaboration_api.py -q`

Run from root: `node --test 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/'*.test.ts 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/projects/[projectId]/'*.test.ts && pnpm --filter @plane/types check:types && pnpm --filter @plane/constants check:types && pnpm --filter web check:types && pnpm --filter web check:format && pnpm --filter web build && git diff --check`

Expected: every command exits 0.

- [ ] **Step 2: Capture populated desktop/mobile acceptance**

Capture Home, Project Overview, Task Center, Documents, Knowledge, Resources, and Notifications at 1440 by 900 and 390 by 844 under `output/playwright/summon-plane-surfaces/`. Each screenshot uses deterministic test fixtures and has a matching zero-error console log.

- [ ] **Step 3: Prove native Plane regression safety**

From Summon, open a Project, Issue, Page, Inbox notification, and Settings link. Perform one safe edit through the native Plane screen, reload it, and confirm Summon reflects the canonical update without a duplicate Summon record.
