# Summon PDF UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose all Summon modules in Plane's primary sidebar and make every Summon-owned page plus sign-in match the supplied Core System Summon PDF without changing native Plane pages or data ownership.

**Architecture:** Keep Plane's existing application shell, authentication behavior, API services, and native routes. Reuse `SUMMON_MODULES`, `SidebarItemBase`, and the existing Summon data pages; centralize the PDF visual language in the current Summon shell/card components so page-specific changes remain layout-only.

**Tech Stack:** React Router 7, React 19, TypeScript, Tailwind CSS 4, SWR, Plane Propel/UI components.

**Spec:** `/Users/muhammadrayaarrizki/Downloads/Core System Summon.pdf`

## Global Constraints

- Native Plane Projects, work items, Pages, notifications, settings, and authentication behavior remain unchanged.
- Summon continues to reuse Plane records and the existing Summon APIs; no duplicate persistence or parallel domain models.
- Use existing dependencies and theme tokens; add no package.
- Preserve workspace permission checks and credential restrictions.
- Verify desktop and mobile layouts plus browser console on production.

---

### Task 1: Visible Summon navigation

**Files:**

- Modify: `packages/constants/src/summon.ts`
- Modify: `packages/i18n/src/locales/en/common.json`
- Modify: `apps/web/core/components/workspace/sidebar/sidebar-menu-items.tsx`
- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/extended-sidebar.tsx`

**Interfaces:**

- Consumes: `SUMMON_MODULES`, `SidebarItemBase`, Plane workspace permission roles.
- Produces: one visible collapsible Summon section containing every allowed Summon route.

- [ ] Reproduce the current failure by confirming the production sidebar has no visible Summon link before opening `More`.
- [ ] Extend the existing Summon navigation constant to include Settings with admin-only access.
- [ ] Render the existing navigation items in one open-by-default disclosure using `SidebarItemBase` and its mobile-close behavior.
- [ ] Remove the same items from the extended `More` panel so navigation is not duplicated.
- [ ] Run constants and web type/format checks.

### Task 2: Shared PDF visual system

**Files:**

- Modify: `apps/web/core/components/summon/page-shell.tsx`
- Modify: `apps/web/core/components/summon/screen.tsx`
- Modify: `apps/web/core/components/summon/forms.tsx`
- Modify: `apps/web/core/components/summon/request-state.tsx`

**Interfaces:**

- Consumes: current `SummonScreen`, `SummonCard`, `SummonRecordList`, `SummonField`, and `SummonSelect` callers.
- Produces: responsive PDF-style page header, search/action area, metric cards, bordered panels, compact record tables, and consistent loading/empty/error states.

- [ ] Capture the current production Summon overview as the failing visual baseline against PDF page 6.
- [ ] Restyle the existing shared components with the PDF's light canvas, blue accent, card hierarchy, compact typography, and responsive overflow behavior.
- [ ] Replace the redundant horizontal module navigation with contextual native-Plane shortcuts because primary Summon navigation now lives in the sidebar.
- [ ] Run web type and format checks.

### Task 3: PDF layouts for Summon-owned pages

**Files:**

- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/page.tsx`
- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/clients/page.tsx`
- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/opportunities/page.tsx`
- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/reports/page.tsx`
- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/resources/page.tsx`
- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/meetings/page.tsx`
- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/automation/page.tsx`
- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/assistant/page.tsx`
- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/credentials/page.tsx`
- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/settings/page.tsx`

**Interfaces:**

- Consumes: existing SWR data, mutations, Plane project store, and shared components from Task 2.
- Produces: PDF-matched information hierarchy while preserving all current create/query/reveal/link actions.

- [ ] Recompose Overview and Reports into metric, health, pipeline, and operational panels using only available live values.
- [ ] Recompose Clients, Opportunities, Resources, and Credentials into compact management tables/cards with their existing creation flows.
- [ ] Recompose Meetings, Automation, and Assistant around the PDF's workspace layouts while preserving their existing API payloads.
- [ ] Recompose Settings as a structured policy/access page linked to Plane settings.
- [ ] Verify loading, empty, error, and populated states remain readable at desktop and mobile widths.

### Task 4: PDF sign-in page

**Files:**

- Modify: `apps/web/core/components/auth-screens/auth-base.tsx`
- Modify: `apps/web/core/components/account/auth-forms/auth-root.tsx`
- Modify: `apps/web/core/components/auth-screens/header.tsx`
- Modify: `apps/web/core/components/auth-screens/footer.tsx`

**Interfaces:**

- Consumes: Plane `AuthRoot`, OAuth configuration, email/password steps, errors, and sign-up feature flag.
- Produces: PDF page-1 split sign-in presentation with the original authentication controls intact.

- [ ] Capture the current sign-in page as the failing visual baseline against PDF page 1.
- [ ] Add the branded benefit panel and centered card presentation around the existing auth form.
- [ ] Update visible Summon copy and footer while keeping redirects, validation, OAuth providers, and terms behavior unchanged.
- [ ] Verify email-to-password sign-in, invalid credentials feedback, and mobile stacking.

### Task 5: Release verification

**Files:**

- Review all changed paths from Tasks 1-4.

**Interfaces:**

- Consumes: completed UI implementation.
- Produces: verified production release.

- [ ] Run `pnpm --filter @plane/constants check:types`, `pnpm --filter web check:types`, `pnpm --filter web check:format`, and `pnpm --filter web build`.
- [ ] Run `git diff --check` and inspect the scoped diff.
- [ ] Commit only related files and push the current commit to `origin/main` so existing Dokploy auto-deploy remains enabled.
- [ ] Wait for production convergence, then sign in and verify the sidebar plus Overview, Opportunities, Credentials, and Settings with zero browser-console errors.
- [ ] Capture one desktop and one mobile production screenshot and report any residual visual gap.
