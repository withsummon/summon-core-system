# Summon Runtime, Shell, and Sign-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove authenticated hydration failures and establish the shared PDF-faithful Summon shell and sign-in composition without changing Plane behavior.

**Architecture:** Keep Plane's SSR, router, sidebar, authentication forms, theme tokens, and modal behavior. Remove render-time nondeterminism, then extend the existing Summon components with only the primitives reused by two or more PDF screens.

**Tech Stack:** React 19, React Router 7, TypeScript, Tailwind CSS 4, Plane UI/Propel, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-22-summon-core-pdf-gap-closure-design.md`

## Global Constraints

- Preserve all native Plane authentication methods, validation, redirects, sidebar controls, and routes.
- Use existing dependencies and theme tokens; add no package.
- Do not hide native Plane navigation or duplicate the Summon section in the extended menu.
- Shared components move into `apps/web/core/components/summon/` only when at least two screens consume them.
- Desktop acceptance is 1440 by 900; mobile acceptance is 390 by 844.

---

### Task 1: Hydration-safe Summon rendering

**Files:**

- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/page.tsx`
- Create: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/hydration.test.ts`
- Test: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/hydration.test.ts`

**Interfaces:**

- Consumes: the existing `SummonOverviewPage` render path.
- Produces: SSR output whose first client render does not depend on local time, random values, browser globals, or unstable store callbacks.

- [ ] **Step 1: Capture the failing browser evidence**

Run the web app, open `/:workspaceSlug/summon/`, reload directly, and record the first React hydration error plus its component stack from the browser console. Save the screenshot and console text under `output/playwright/summon-runtime/baseline/`.

- [ ] **Step 2: Write the failing nondeterminism guard**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Summon Home has no render-time clock or random dependency", () => {
  const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /new Date\(\)\.getHours\(\)|Math\.random\(\)/);
});
```

- [ ] **Step 3: Run the test and verify it fails**

Run: `node --test 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/hydration.test.ts'`

Expected: FAIL because Home currently calls `new Date().getHours()` during render.

- [ ] **Step 4: Make the first render deterministic**

Use stable copy on the server/client render path. Personalized time-of-day text is not required by the PDF and is removed.

```tsx
const firstName = (user?.display_name || user?.first_name || "there").split(" ")[0];
const heading = `Welcome back, ${firstName}!`;
```

Trace the captured component stack and remove any additional first-render differences at their shared source. Do not use `suppressHydrationWarning` to conceal application markup mismatches.

- [ ] **Step 5: Run focused checks and browser reload**

Run: `node --test 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/hydration.test.ts' && pnpm --filter web check:types`

Expected: PASS. Directly reload Home, Opportunities, and Credentials; the console contains no React hydration or uncaught runtime errors.

- [ ] **Step 6: Commit the root-cause fix**

```bash
git add -- 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/page.tsx' 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/hydration.test.ts'
git commit -m "fix(summon): make authenticated rendering hydration-safe"
```

---

### Task 2: Shared Summon visual primitives

**Files:**

- Modify: `apps/web/core/components/summon/page-shell.tsx`
- Modify: `apps/web/core/components/summon/screen.tsx`
- Modify: `apps/web/core/components/summon/forms.tsx`
- Modify: `apps/web/core/components/summon/request-state.tsx`
- Create: `apps/web/core/components/summon/progress.tsx`
- Create: `apps/web/core/components/summon/screen.test.ts`

**Interfaces:**

- Consumes: existing `SummonScreen`, `SummonCard`, `SummonMetric`, `SummonRecordList`, `SummonField`, `SummonSelect`, and `SummonRequestState` callers.
- Produces: backward-compatible primitives plus `SummonProgressRing({ value, label })` and `SummonProgressBar({ value, label })`.

- [ ] **Step 1: Write a failing source contract test**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("shared Summon UI exposes progress primitives without a chart package", () => {
  const source = readFileSync(new URL("./progress.tsx", import.meta.url), "utf8");
  assert.match(source, /export function SummonProgressRing/);
  assert.match(source, /conic-gradient/);
  assert.doesNotMatch(source, /recharts|chart\.js|echarts/);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test apps/web/core/components/summon/screen.test.ts`

Expected: FAIL because `progress.tsx` does not exist.

- [ ] **Step 3: Implement the native CSS primitives**

```tsx
export function SummonProgressRing({ value, label }: { value: number; label: string }) {
  const safeValue = Math.min(100, Math.max(0, value));
  return (
    <div
      className="grid size-20 place-items-center rounded-full"
      style={{ background: `conic-gradient(var(--color-accent-primary) ${safeValue}%, var(--color-layer-2) 0)` }}
      aria-label={`${label}: ${safeValue}%`}
    >
      <span className="grid size-16 place-items-center rounded-full bg-surface-1 text-sm font-semibold text-primary">
        {safeValue}%
      </span>
    </div>
  );
}

export function SummonProgressBar({ value, label }: { value: number; label: string }) {
  const safeValue = Math.min(100, Math.max(0, value));
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-layer-2"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safeValue}
    >
      <div className="h-full rounded-full bg-accent-primary" style={{ width: `${safeValue}%` }} />
    </div>
  );
}
```

Update existing components to expose compact header/actions, bordered table shells, filter rows, contextual rails, and explicit loading/empty/validation/permission/request-error states while preserving current props.

- [ ] **Step 4: Run focused checks**

Run: `node --test apps/web/core/components/summon/screen.test.ts && pnpm --filter web check:types && pnpm --filter web check:format`

Expected: PASS with no added dependency.

- [ ] **Step 5: Commit the shared visual layer**

```bash
git add -- apps/web/core/components/summon
git commit -m "feat(summon): add shared PDF visual primitives"
```

---

### Task 3: PDF-faithful Plane sign-in composition

**Files:**

- Modify: `apps/web/core/components/auth-screens/auth-base.tsx`
- Modify: `apps/web/core/components/account/auth-forms/auth-root.tsx`
- Modify: `apps/web/core/components/auth-screens/header.tsx`
- Modify: `apps/web/core/components/auth-screens/footer.tsx`
- Create: `apps/web/core/components/auth-screens/summon-auth-layout.test.ts`

**Interfaces:**

- Consumes: Plane's existing auth form state machine, OAuth configuration, email/password fields, error rendering, and redirects.
- Produces: the PDF page-1 split presentation without owning or replacing authentication logic.

- [ ] **Step 1: Write the failing preservation test**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Summon auth composition keeps the canonical AuthRoot", () => {
  const source = readFileSync(new URL("../account/auth-forms/auth-root.tsx", import.meta.url), "utf8");
  assert.match(source, /AuthRoot/);
  assert.doesNotMatch(source, /fetch\(|axios\.|summonService/);
});
```

- [ ] **Step 2: Capture baseline and run the test**

Run: `node --test apps/web/core/components/auth-screens/summon-auth-layout.test.ts`

Expected: the preservation assertion passes; the PDF visual comparison fails because the split benefit panel is absent.

- [ ] **Step 3: Recompose around the existing form**

```tsx
<main className="grid min-h-screen bg-surface-1 lg:grid-cols-[minmax(22rem,0.9fr)_minmax(32rem,1.1fr)]">
  <aside
    className="hidden bg-accent-primary p-10 text-on-color lg:flex lg:flex-col lg:justify-between"
    aria-label="Summon Core product overview"
  >
    <div>
      <p className="text-sm font-semibold">Summon Core</p>
      <h1 className="mt-10 max-w-md text-4xl font-semibold">
        One workspace for delivery, knowledge, clients, and AI-assisted operations.
      </h1>
    </div>
    <p className="text-sm text-on-color/80">Powered by the Plane collaboration foundation.</p>
  </aside>
  <section className="grid place-items-center p-5">
    <div className="w-full max-w-md">{children}</div>
  </section>
</main>
```

Keep existing buttons, inputs, OAuth providers, terms links, feature flags, errors, and redirect code unchanged inside `AuthRoot`.

- [ ] **Step 4: Verify the real authentication flow**

Run: `pnpm --filter web check:types && pnpm --filter web check:format && pnpm --filter web build`

Expected: PASS. In a browser, verify email-to-password transition, invalid-password feedback, successful login redirect, OAuth buttons when configured, and mobile stacking at 390 by 844 with zero console errors.

- [ ] **Step 5: Commit sign-in composition**

```bash
git add -- apps/web/core/components/auth-screens apps/web/core/components/account/auth-forms/auth-root.tsx
git commit -m "feat(summon): match the PDF sign-in composition"
```

---

### Task 4: Runtime plan acceptance

**Files:**

- Review: all files changed by Tasks 1 through 3.

**Interfaces:**

- Consumes: hydration fix, shared primitives, and sign-in composition.
- Produces: a clean baseline for the remaining Summon route plans.

- [ ] **Step 1: Run the complete scoped verification**

Run: `node --test 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/'*.test.ts apps/web/core/components/summon/*.test.ts apps/web/core/components/auth-screens/*.test.ts && pnpm --filter web check:types && pnpm --filter web check:format && pnpm --filter web build && git diff --check`

Expected: every command exits 0.

- [ ] **Step 2: Capture browser acceptance artifacts**

Capture sign-in desktop/mobile and authenticated Home desktop/mobile under `output/playwright/summon-runtime/accepted/`. Directly reload both routes and export the browser console log; accepted logs contain zero hydration and uncaught runtime errors.

- [ ] **Step 3: Review scope**

Run: `git status --short && git diff --stat && git diff -- apps/web/core/components/auth-screens apps/web/core/components/account/auth-forms apps/web/core/components/summon 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/page.tsx'`

Expected: only the planned runtime and presentation files are present.
