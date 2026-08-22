# Summon Reporting and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete live PDF-faithful management reporting and prove all seventeen PDF screens plus native Plane regressions are release-ready.

**Architecture:** Extend the current computed report service with permission-filtered filter/query contracts and chart-ready series, then render with shared CSS/native SVG primitives. Finish with a deterministic browser matrix, read-back UAT, full regression checks, and a separate explicit deployment-authorization gate.

**Tech Stack:** Django 5, Django REST Framework, PostgreSQL, React 19, React Router 7, TypeScript, SWR, CSS/native SVG, Playwright, Docker Compose pytest stack.

**Spec:** `docs/superpowers/specs/2026-08-22-summon-core-pdf-gap-closure-design.md`

## Global Constraints

- Reports are computed from canonical Plane/Summon records; add no report snapshot model.
- Unauthorized workspace/project records never contribute to totals, series, tables, or exports.
- Add no chart or spreadsheet dependency; use CSS/native SVG and Python standard-library CSV.
- Exact PDF names, counts, dates, avatars, and business values are not copied into production.
- Unsupported exports remain visibly unavailable; never return a fake file.
- Do not push, deploy, or change production until the user explicitly authorizes that external state change.

---

### Task 1: Filtered report aggregates and safe CSV export

**Files:**

- Modify: `apps/api/plane/summon/services/reports.py`
- Modify: `apps/api/plane/summon/serializers/operations.py`
- Modify: `apps/api/plane/summon/views/operations.py`
- Modify: `apps/api/plane/summon/urls.py`
- Modify: `apps/api/plane/tests/contract/summon/test_operations_api.py`
- Modify: `packages/types/src/summon/index.ts`
- Modify: `apps/web/core/services/summon.service.ts`

**Interfaces:**

- Consumes: `visible_project_ids(workspace, user)`, canonical Plane Project/Issue/Page/FileAsset and Summon Client/Opportunity/Meeting/Automation records.
- Produces: expanded `GET /reports/summary/` filters and `GET /reports/export.csv` with chart-ready series.

- [ ] **Step 1: Write failing filter, isolation, and CSV-injection tests**

```python
@pytest.mark.django_db
def test_report_filters_and_series_exclude_hidden_projects(session_client, workspace, create_user):
    visible, _, _ = create_project(workspace, create_user, "VIS")
    hidden = Project.objects.create(workspace=workspace, name="Hidden", identifier="HID")
    response = session_client.get(f"/api/summon/workspaces/{workspace.slug}/reports/summary/?project_id={visible.id}")
    assert response.status_code == 200
    assert {item["project_id"] for item in response.data["project_health"]} == {str(visible.id)}
    assert str(hidden.id) not in str(response.data)


@pytest.mark.django_db
def test_report_csv_escapes_formula_cells(session_client, workspace):
    Client.objects.create(workspace=workspace, name="=cmd|' /C calc'!A0")
    response = session_client.get(f"/api/summon/workspaces/{workspace.slug}/reports/export.csv")
    assert response.status_code == 200
    assert b"'=cmd" in response.content
```

- [ ] **Step 2: Run focused tests and verify missing series/export**

Run from `apps/api`: `pytest plane/tests/contract/summon/test_operations_api.py -q`

Expected: FAIL because chart series, filters, and export route are absent.

- [ ] **Step 3: Add validated filters and one canonical report query**

```python
class ReportFilterSerializer(serializers.Serializer):
    project_id = serializers.UUIDField(required=False)
    client_id = serializers.UUIDField(required=False)
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)

    def validate(self, attrs):
        if attrs.get("date_from") and attrs.get("date_to") and attrs["date_from"] > attrs["date_to"]:
            raise serializers.ValidationError({"date_to": "Must be on or after date_from."})
        return attrs
```

Return project health, opportunity stages/value, due-date buckets, completion trend, knowledge totals, meeting status/trend, automation status/usage, and recent activity. Derive every series from the same permission-filtered base query used by totals.

- [ ] **Step 4: Implement safe standard-library CSV export**

```python
def csv_cell(value):
    text = "" if value is None else str(value)
    return f"'{text}" if text.startswith(("=", "+", "-", "@")) else text


def report_csv(rows):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Section", "Label", "Value"])
    for section, label, value in rows:
        writer.writerow([csv_cell(section), csv_cell(label), csv_cell(value)])
    return output.getvalue()
```

Return `text/csv` with a deterministic filename. The export endpoint accepts the same validated filters and permission boundary as summary.

- [ ] **Step 5: Extend TypeScript contracts and service calls**

```ts
export interface ISummonReportSummary {
  projects: number;
  issues: { total: number; completed: number; overdue: number };
  commercial: { clients: number; opportunities: number; pipeline_value: string };
  project_health: Array<{ project_id: string; name: string; health: string; completion: number }>;
  opportunity_stages: Array<{ stage: TSummonOpportunityStage; count: number; value: string }>;
  due_date_buckets: Array<{ label: string; count: number }>;
  completion_trend: Array<{ date: string; completed: number }>;
  knowledge: { pages: number; files: number };
  meetings: number;
  meeting_statuses: Array<{ status: string; count: number }>;
  automation: { jobs: number; completed: number; failed: number };
}
```

Add `getReport(workspaceSlug, filters)` and `getReportExportUrl(workspaceSlug, filters)` with URLSearchParams; do not manually concatenate unescaped filter values.

- [ ] **Step 6: Run contract and type checks**

Run from `apps/api`: `pytest plane/tests/contract/summon/test_operations_api.py -q`

Run from root: `pnpm --filter @plane/types check:types && pnpm --filter web check:types`

Expected: PASS, including cross-workspace, invalid date range, and CSV formula cases.

- [ ] **Step 7: Commit report contracts**

```bash
git add -- apps/api/plane/summon apps/api/plane/tests/contract/summon/test_operations_api.py packages/types/src/summon/index.ts apps/web/core/services/summon.service.ts
git commit -m "feat(summon): add filtered management reporting"
```

---

### Task 2: PDF Management & Reporting web screen

**Files:**

- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/reports/page.tsx`
- Create: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/reports/report-view.tsx`
- Create: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/reports/report-view.test.ts`
- Modify: `apps/web/core/components/summon/progress.tsx`

**Interfaces:**

- Consumes: Task 1 report summary/export and shared Summon cards/progress primitives.
- Produces: PDF page-3 management reporting with filters, accessible CSS/native SVG charts, tables, empty/error states, and real CSV download.

- [ ] **Step 1: Write failing transformation tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { percentage } from "./report-view";

test("report percentages handle empty and populated totals", () => {
  assert.equal(percentage(0, 0), 0);
  assert.equal(percentage(3, 4), 75);
});
```

- [ ] **Step 2: Run the test and verify missing helpers**

Run: `node --test 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/reports/report-view.test.ts'`

Expected: FAIL because `report-view.tsx` is absent.

- [ ] **Step 3: Implement minimal safe transformations**

```ts
export const percentage = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : 0);
```

Render portfolio metrics, project health, delivery progress, opportunity pipeline, due-date buckets, completion trend, knowledge, meetings, automation, and recent activity. Display the server-computed decimal `commercial.pipeline_value`; do not recompute currency with JavaScript floating point. Use `SummonProgressRing`, `SummonProgressBar`, CSS grids/bars, and a small semantic SVG only for the line trend.

- [ ] **Step 4: Wire filters and real export**

```tsx
const reportKey = [
  "summon-report",
  workspaceSlug,
  filters.projectId,
  filters.clientId,
  filters.dateFrom,
  filters.dateTo,
];
const { data, error, isLoading, mutate } = useSWR(reportKey, () => summonService.getReport(workspaceSlug, filters));
```

Filter changes update the URL query string and SWR key so direct reload preserves selection. Export uses the matching server URL and filename; show a disabled control only for formats the backend does not support.

- [ ] **Step 5: Run checks and browser acceptance**

Run: `node --test 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/reports/report-view.test.ts' && pnpm --filter web check:types && pnpm --filter web check:format && pnpm --filter web build`

Expected: PASS. Browser applies each filter, reloads, downloads CSV, opens the file, verifies expected headings/filtered values, and reports zero console errors.

- [ ] **Step 6: Commit reporting UI**

```bash
git add -- 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/reports' apps/web/core/components/summon/progress.tsx
git commit -m "feat(summon): implement PDF management reporting"
```

---

### Task 3: Seventeen-screen browser acceptance matrix

**Files:**

- Create: `docs/qa/summon-pdf-acceptance.md`
- Create: `scripts/check-summon-pdf-routes.sh`
- Review: all Summon web routes and native Plane links.

**Interfaces:**

- Consumes: completed Plans 1 through 5 and deterministic local test fixtures.
- Produces: route/interaction evidence for all seventeen PDF screens plus Documents.

- [ ] **Step 1: Add a route-presence guard**

```sh
#!/bin/sh
set -eu
base='apps/web/app/(all)/[workspaceSlug]/(projects)/summon'
for path in page.tsx projects/page.tsx projects/'[projectId]'/page.tsx knowledge/page.tsx reports/page.tsx clients/page.tsx clients/'[clientId]'/page.tsx credentials/page.tsx settings/page.tsx opportunities/page.tsx opportunities/'[opportunityId]'/page.tsx resources/page.tsx automation/page.tsx assistant/page.tsx tasks/page.tsx meetings/page.tsx meetings/'[meetingId]'/page.tsx notifications/page.tsx documents/page.tsx; do
  test -f "$base/$path" || { echo "Missing Summon route: $path" >&2; exit 1; }
done
```

- [ ] **Step 2: Run the guard and fix any route gap**

Run: `sh scripts/check-summon-pdf-routes.sh`

Expected: exit 0 with no missing route.

- [ ] **Step 3: Record the exact UAT matrix**

`docs/qa/summon-pdf-acceptance.md` contains one row per PDF screen with route/state, fixture, required click flow, persistence/read-back check, 1440x900 screenshot, 390x844 screenshot, console result, and status. The Power-K row is an interaction state rather than a route; sign-in and instance-admin AI configuration use their canonical applications.

- [ ] **Step 4: Execute the authenticated browser matrix**

Use a deterministic test workspace containing at least two projects, one client/contact/opportunity, issues in multiple states/dates, Pages/FileAssets, a meeting/transcript, resources, a credential/grant/audit, one Assistant conversation, one Automation preview/published Page, and notifications. Exercise all seventeen screens plus Documents; capture unique desktop/mobile evidence under `output/playwright/summon-pdf-acceptance/`.

- [ ] **Step 5: Verify accessibility basics during each flow**

Keyboard-tab through navigation, filters, dialogs, drawers, forms, Assistant composer, Automation preview/publish, and credential confirmation. Verify visible focus, field labels, dialog names, semantic headings, non-color status labels, readable contrast, and no clipped mobile actions.

- [ ] **Step 6: Commit the acceptance harness and completed ledger**

```bash
git add -- scripts/check-summon-pdf-routes.sh docs/qa/summon-pdf-acceptance.md
git commit -m "test(summon): add complete PDF acceptance matrix"
```

---

### Task 4: Full regression and release gate

**Files:**

- Review: all changed files from the five gap-closure plans.
- Update: `docs/qa/summon-pdf-acceptance.md`

**Interfaces:**

- Consumes: completed implementation and browser evidence.
- Produces: a reviewable local release candidate; production action remains separately authorized.

- [ ] **Step 1: Run repository boundary and diff checks**

Run: `sh scripts/check-summon-boundaries.sh && sh scripts/check-summon-pdf-routes.sh && git diff --check && git status --short && git diff --stat`

Expected: boundary checks pass and only planned paths are changed.

- [ ] **Step 2: Run frontend/admin/type/format/build checks**

Run: `pnpm --filter @plane/types check:types && pnpm --filter @plane/constants check:types && pnpm --filter @plane/services check:types && pnpm --filter admin check:types && pnpm --filter web check:types && pnpm --filter admin check:format && pnpm --filter web check:format && pnpm --filter admin build && pnpm --filter web build`

Expected: every command exits 0.

- [ ] **Step 3: Run focused backend regression in the isolated stack**

Run: `docker compose -f docker-compose-test.yml run --rm api-tests pytest plane/tests/unit/services/test_llm.py plane/tests/contract/license/test_llm_configuration.py plane/tests/contract/summon -q`

Expected: every focused unit/contract test passes.

- [ ] **Step 4: Run native Plane smoke regressions**

In the browser, sign in and exercise native Projects, one Issue edit, one Page edit, Inbox notification, workspace Settings, profile Settings, sidebar collapse/mobile drawer, and a native Power-K command. Reload each edited record and confirm persistence with zero console errors.

- [ ] **Step 5: Review implementation against the approved spec**

For every section of `docs/superpowers/specs/2026-08-22-summon-core-pdf-gap-closure-design.md`, link the passing test or browser artifact in `docs/qa/summon-pdf-acceptance.md`. Mark unsupported speech-to-text, RAG, autonomous writes, and non-CSV exports as explicit non-goals, not implemented claims.

- [ ] **Step 6: Stop at the deployment authorization gate**

Report the exact branch, commit list, test results, browser matrix, residual risks, and production target. Do not push, merge, deploy, or mutate production until the user explicitly approves those actions.

- [ ] **Step 7: After explicit deployment approval, verify production convergence**

Push only the reviewed commits through the repository's approved release path, wait for the deployed revision to match, then rerun the real sign-in, all seventeen PDF screens, Documents, one real configured-provider Assistant request, one Automation preview/publish/read-back, one meeting summary/read-back, native Plane regressions, and console inspection on the production URL. Update the acceptance ledger with live evidence and distinguish local proof from live proof.
