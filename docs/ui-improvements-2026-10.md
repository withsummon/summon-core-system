# Summon UI improvements: October 2026 audit

This audit ranks what to fix next in the Summon web app. The Base UI 1.9 makeover is already in place and is not re-proposed here: native drawers, the sliding tab indicator, Phosphor icons that fill when selected, icon chips and badges, and Summon blue. Where those patterns stop short of a screen, that gap is listed.

I checked every item against the `ui-makeover` skill (updated on 2026-10-11 with the Fikes lessons in `references/hierarchy-density-and-phone.md`) and against `make-interfaces-feel-better`.

**How this was checked**

- **Running app:** local `main` at `34f033f7f1`, Bun 1.4.2, web dev server on :3000, Django API from `docker-compose-local.yml`, signed in with the local test account.
- **Viewports:** desktop at 1440×900, phone at 390×844, plus a dark-mode pass using the app's own theme toggle.
- **Screenshots:** in [`ui-improvements-2026-10/`](ui-improvements-2026-10/), numbered as cited below.
- **Every file:line was read in source.** The functional bugs (#1, #2) were reproduced in the browser.

**Effort:** S is under half a day, M is 1–2 days, L needs a product decision or several days.
**Impact:** how many screens or users it touches, and how visible it is.

## Top 15 at a glance

| #   | Item                                                                           | Group  | Effort | Impact   |
| --- | ------------------------------------------------------------------------------ | ------ | ------ | -------- |
| 1   | "Manage features" on disabled Cycles/Modules/Views/Pages/Intake leads to a 404 | Plane  | S      | High     |
| 2   | Creating a cycle fails with "Error in creating cycle" (empty project id)       | Plane  | S      | High     |
| 3   | One page-header owner (11 hand-built `h1`s, 5 sizes)                           | Shared | M      | High     |
| 4   | Field family parity: date picker, textarea and input disagree                  | Shared | S–M    | High     |
| 5   | Phone top bar pushes inbox/help/theme/profile off-screen                       | Shared | S      | High     |
| 6   | Tabs clip on narrow widths; panels don't rise in                               | Shared | M      | High     |
| 7   | Metric cards: a fake button on every card, placeholder metrics                 | Shared | M      | High     |
| 8   | Always-open create forms docked beside lists, not drawers                      | Summon | M      | High     |
| 9   | Settings navs never show the active page                                       | Shared | S      | Med–High |
| 10  | Work-item rows and cards show 5 empty bordered property boxes                  | Plane  | M      | Med–High |
| 11  | Credentials: docked detail column with a dead close button                     | Summon | M      | Med–High |
| 12  | Empty states: box-in-box cards and legacy Plane art                            | Shared | M      | Med      |
| 13  | One label owner per status, and one language                                   | Shared | S      | Med      |
| 14  | Home: clipped filter chips; phone stacks a second full screen                  | Summon | S–M    | Med–High |
| 15  | Implementation jargon in UI copy (Plane, UUID, RAG, LLM)                       | Shared | S      | Med      |

Items 16–25 are below, in their groups.

---

## Functional bugs found during the audit

These two break a journey outright, so they rank above every visual item. They live in inherited Plane code. They are listed again under Group C with full detail.

- **#1 — "Manage features" goes to a 404.** Screenshots 21, 22 and 23.
- **#2 — Creating a cycle fails.** Screenshot 25.

---

## A. Shared primitives and tokens (fix once, applies everywhere)

### 3. One page-header owner

- **Where:** every Summon screen. `SummonScreen` already has a header at [screen.tsx:26-35](../apps/web/core/components/summon/screen.tsx:26), but 11 screens build their own `h1`:
  - [documents-root.tsx:64](../apps/web/core/components/summon/documents/documents-root.tsx:64): `text-2xl font-bold`
  - [notifications-root.tsx:50](../apps/web/core/components/summon/notifications/notifications-root.tsx:50): bold
  - [resources-root.tsx:194](../apps/web/core/components/summon/resources/resources-root.tsx:194): bold
  - [credentials/page.tsx:200](<../apps/web/app/(all)/[workspaceSlug]/(projects)/summon/credentials/page.tsx:200>): `text-xl`
  - [opportunities/page.tsx:110](<../apps/web/app/(all)/[workspaceSlug]/(projects)/summon/opportunities/page.tsx:110>): `text-20`
  - [tasks-root.tsx:136](../apps/web/core/components/summon/tasks/tasks-root.tsx:136): `text-base`
  - [projects-directory-root.tsx:63](../apps/web/core/components/summon/projects/projects-directory-root.tsx:63): `text-sm` inside a Plane-style bar
- **What's wrong:** Moving between sidebar items changes the title size (14 → 16 → 20 → 24px), the weight (semibold vs bold), the gutter (Documents and Notifications sit about 12px further in than Clients) and where the actions sit. Projects and Tasks use a compact bar, and the other screens use a large title plus description. Compare screenshots 02, 04, 05, 07 and 12.
- **Fix:** Make `SummonScreen` (or a `PageHeader` it exports) the only header: title, optional count, description and actions. Use one size (20px semibold, -0.01em) and one gutter. Pick one of the two layouts (large title or compact bar) for all list screens. The compact bar fits dense lists better. Delete the hand-built headers.
- **Skill rule:** ui-makeover §7, real heading hierarchy; guardrail "prefer editing an owner over call sites".

### 4. Field family parity

- **Where:** every form. Measured on Clients → Add client (screenshot 02; dark mode in screenshot 39):

  | Control                | Owner                                                                                                      | Height | Radius | Border                         | Text |
  | ---------------------- | ---------------------------------------------------------------------------------------------------------- | ------ | ------ | ------------------------------ | ---- |
  | Input                  | [propel/input/input.tsx:38](../packages/propel/src/input/input.tsx:38)                                     | 37.5px | 10px   | hairline, `oklch(0.922)`       | 13px |
  | Date picker            | [propel/date-picker/root.tsx:70-76](../packages/propel/src/date-picker/root.tsx:76)                        | 36px   | 6px    | `border-strong`, `oklch(0.85)` | 13px |
  | Textarea, hand-written | [clients/page.tsx:138-142](<../apps/web/app/(all)/[workspaceSlug]/(projects)/summon/clients/page.tsx:138>) | —      | 6px    | —                              | 12px |
  | Textarea, `@plane/ui`  | [ui/form-fields/textarea.tsx:48](../packages/ui/src/form-fields/textarea.tsx:48)                           | —      | —      | 0.5px                          | —    |

- **What's wrong:**
  - The date picker has the darkest outline on the form.
  - The textarea's text is a step smaller than the inputs.
  - In dark mode, inputs are borderless fills while the date picker and textarea are outlined boxes.
- **Fix:**
  - Give every field-like trigger the input's height, radius, fill and hairline: date picker, select, combobox, textarea and search.
  - Add one `--border-field` token if an empty field needs to be a step darker than the button hairline.
  - Replace the raw `<textarea>` with the primitive.
  - Keep `border-strong` only for checkboxes and radios.
  - Field-edge contrast drops below 3:1 with this change, so report that trade-off.
- **Skill rule:** ui-makeover §5 (every field-like control shares one field-border token and the buttons' text size); hierarchy-density-and-phone §2.

### 5. The phone top bar pushes actions off-screen

- **Where:** the global header at 390px (screenshots 31–37). The cause is `TopNavPowerK`'s fixed `w-[364px]` ([top-nav-power-k.tsx:212](../apps/web/core/components/navigation/top-nav-power-k.tsx:212)) inside a `shrink-0` wrapper ([top-navigation-root.tsx:64](../apps/web/core/components/navigation/top-navigation-root.tsx:64)).
- **What's wrong:** The search field is cut off at the right edge. Inbox, help, theme and the profile avatar aren't visible at all. Clients also shows two sidebar toggles: one in the bar and one beside the page title (screenshot 33).
- **Fix:**
  - Below `md`, render search as a 32px icon button that opens Power K.
  - Above `md`, let the field shrink (`w-full max-w-[364px] min-w-0`).
  - Remove the page-level sidebar toggle wherever the bar already has one.
- **Skill rule:** hierarchy-density-and-phone §10 (phone layouts are their own design; check overflow on every route).

### 6. Tabs clip on narrow widths, and panels don't rise in

- **Where:** the propel `Tabs.List` ([tabs.tsx:108-110](../packages/propel/src/tabs/tabs.tsx:108)) uses `overflow-auto` with the scrollbar hidden. `Tabs.Content` ([tabs.tsx:163](../packages/propel/src/tabs/tabs.tsx:163)) has no entry animation.
- **What's wrong:** On a phone, tabs are cut off with no hint that more exist:
  - Tasks: "All tasks" is hidden (screenshot 36).
  - Reports: cut at "Project H…" (screenshot 37).
  - Home project tabs: cut at "Acc…" (screenshot 31).

  Automation's generated-documents tabs also clip at 1440px (screenshot 10). Switching tabs swaps the panel content instantly.

- **Fix:**
  - Below `md`, the underline variant becomes column tabs (about 22px icon over an 11–12px medium label). Do this in the primitive.
  - Where there are more than 5 tabs, keep horizontal scroll but add an edge fade mask and `scroll-snap`.
  - Give `Tabs.Content` the rise-in: `motion-safe:animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out`.
  - Keep labels medium weight. They already are; don't let screens override it.
- **Skill rule:** hierarchy-density-and-phone §6 (panels rise in) and §10 (tabs become columns).

### 7. Metric cards: a fake button on every card, and metrics with nothing in them

- **Where:**
  - [`SummonMetric`, screen.tsx:58-71](../apps/web/core/components/summon/screen.tsx:67) draws an `ArrowUpRight` keycap that looks like a button but has no action.
  - Hand-built metric strips repeat the pattern:
    - [documents-root.tsx:92-126](../apps/web/core/components/summon/documents/documents-root.tsx:120): "Editor Integration: Native Plane"
    - [notifications-root.tsx:72-104](../apps/web/core/components/summon/notifications/notifications-root.tsx:98): "Feed Status: Live Sync"
    - Credentials
    - Knowledge Stats ("Total Views: Unavailable")
    - Clients ("Retention: —, No metric source configured")
- **What's wrong:**
  - Every metric looks clickable and isn't.
  - Several cards are constants or placeholders, so a third of the row tells the user nothing.
  - Detail lines like "Authorized workspace records" and "Persisted client status" describe the implementation.
  - The cards truncate on a phone (screenshot 33).

  See screenshots 02, 06, 07, 08, 11 and 12.

- **Fix:**
  - Use one Metric primitive with no decorative button. If a metric should navigate, make the whole card a link with a hover state and a chevron.
  - Don't render metrics that have no source.
  - Collapse the rest into one compact strip (label, number, optional delta).
  - On a phone, show them as a 2-column strip with no icon tile.
- **Skill rule:** guardrail "never make non-functional controls look functional"; hierarchy-density-and-phone §6 ("a header band or tab strip must carry data").

### 9. Settings navs never show the active page

- **Where:** [`SettingsSidebarItem`, settings/sidebar/item.tsx:28-34](../apps/web/core/components/settings/sidebar/item.tsx:28), used by workspace, project and profile settings. Active matching is in [project/sidebar/item-categories.tsx:56-59](../apps/web/core/components/settings/project/sidebar/item-categories.tsx:56).
- **What's wrong:**
  - On `/settings/members` and `/settings/projects/:id/features/cycles`, no item looks selected (screenshots 24, 28). The match regex requires a trailing `/`, and these links arrive without one.
  - When an item does match, it gets a grey fill, an outline icon and no `aria-current`. That isn't the accent-tint, filled-icon recipe the main sidebar uses (profile settings, screenshot 29).
- **Fix:**
  - Normalize the trailing slash before matching.
  - Restyle the item to the nav recipe: accent-subtle fill, accent-primary text, semibold, `SelectableIcon` under `group/select`, and `aria-current="page"`.
  - It's one owner, so all three settings areas inherit the fix.
- **Skill rule:** selection-and-motion §2–3 (nav item selected recipe; filled icons through one owner).

### 12. Empty states: box-in-box cards and legacy Plane art

- **Where:**
  - `SummonRequestState` empty mode draws a bordered card ([request-state.tsx:32](../apps/web/core/components/summon/request-state.tsx:32)). Callers put it inside another card: Documents, Notifications, the Assistant chat rail, and Credentials ([credentials/page.tsx:373](<../apps/web/app/(all)/[workspaceSlug]/(projects)/summon/credentials/page.tsx:373>)), where it sits a card inside a column inside a card.
  - The disabled-feature states for Cycles, Modules, Views, Pages and Intake show WebP screenshots of the old Plane UI in its navy brand ([cycles (list)/page.tsx:20-21](<../apps/web/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/cycles/(list)/page.tsx:20>), assets in `app/assets/empty-state/disabled-feature/`).
  - The 404 page uses Plane's illustration and "Oops! Something went wrong." with no app shell ([not-found.tsx:11-29](../apps/web/app/not-found.tsx:26)).
- **What's wrong:** Nested borders around one line of grey text. The Modules art is a dark navy block that clashes with Summon blue (screenshot 22). The 404 strands the user outside the app (screenshot 23).
- **Fix:**
  - One empty-state primitive: no border when nested, a `bg-dot-grid` region, a 32px icon chip, a 16px title, one line of text and at most one action.
  - Replace the disabled-feature WebPs with the same primitive: the feature icon, "Cycles are off for this project" and "Turn on cycles" (see #1).
  - Render 404 inside the shell, with "Back to Home".
- **Skill rule:** ui-makeover §7 (dotted empty states instead of box-in-box); make-interfaces-feel-better (one surface per state).

### 13. One label owner per status, and one language

- **Where:** `not_assessed` is labeled in three places:
  - "Belum dinilai" in [project-workspace.ts:24](../apps/web/core/components/summon/projects/project-workspace.ts:24), [report-view-model.ts:40](<../apps/web/app/(all)/[workspaceSlug]/(projects)/summon/reports/report-view-model.ts:40>) and [project-profile-editor.tsx:132,154](<../apps/web/app/(all)/[workspaceSlug]/(projects)/summon/projects/[projectId]/project-profile-editor.tsx:132>)
  - "Not assessed" from `StatusBadge` ([status-badge.tsx:45](../apps/web/core/components/summon/status-badge.tsx:45))

  The Assistant's empty state is in Indonesian inside an English UI ([message-list.tsx:89](<../apps/web/app/(all)/[workspaceSlug]/(projects)/summon/assistant/message-list.tsx:89>)).

- **What's wrong:** The same project reads "Not assessed" on Home and "Belum dinilai" on Projects, Project detail and Reports (screenshots 01, 04, 13, 16). Project detail shows it twice, for Health and Status.
- **Fix:** Make `StatusBadge`'s map the only label source and delete the three local copies. Route all copy through `@plane/i18n` so the locale switch is the one place that chooses language.
- **Skill rule:** selection-and-motion §5 (one record mapping status → icon, tone, label; humanize with existing utilities).

### 15. Implementation jargon in UI copy

- **Where:**
  - Meetings: "Plane Project" ([meetings/page.tsx:142](<../apps/web/app/(all)/[workspaceSlug]/(projects)/summon/meetings/page.tsx:142>)), "UUID from the work item URL" (:176), "Live Plane work items" (:88)
  - Clients: "Authorized workspace records" ([clients/page.tsx:76](<../apps/web/app/(all)/[workspaceSlug]/(projects)/summon/clients/page.tsx:76>))
  - Settings: "Plane-owned workspace identity"
  - Assistant: "Automatic RAG · provider appears after the first response"
  - Automation: "LLM-assisted Client Proposal" on every template card
  - Documents: "Indexed Plane Pages"
  - Notifications: "Open Plane Inbox"
- **What's wrong:** Summon users see the vendor and the stack (Plane, UUID, RAG, LLM). Asking the user to paste a UUID is a workflow gap, not just bad copy.
- **Fix:**
  - Use product nouns: Project, Task, Assistant.
  - Replace the UUID field with a task combobox.
  - Drop the per-card "LLM-assisted" subtitle.
- **Skill rule:** hierarchy-density-and-phone §5 (show state, not prose); `ui-copywriting-hig`.

### 17. Sidebar collapse leaks from phone to desktop

- **Where:** [\_sidebar.tsx:39-44](<../apps/web/app/(all)/[workspaceSlug]/(projects)/_sidebar.tsx:39>) calls `toggleSidebar(true)` whenever the viewport is under 768px. `toggleSidebar` persists the value to `localStorage` ([theme.store.ts:91-98](../apps/web/core/store/theme.store.ts:97)).
- **What's wrong:** After using the app at phone width, the desktop sidebar stays collapsed until the user re-expands it. It happened during this audit.
- **Fix:** Keep the phone's closed state in transient state and persist only explicit user toggles.
- **Skill rule:** hierarchy-density-and-phone §9 (a remembered fold must be the user's choice).
- **Effort / impact:** S / Med.

### 18. The switch's off state is invisible

- **Where:** [propel/switch/root.tsx:28-36](../packages/propel/src/switch/root.tsx:28). When off, the track is `bg-surface-2` (`oklch(0.985)`) with a `border-subtle` hairline on a white card.
- **What's wrong:** In project feature settings, an off toggle is almost invisible (screenshot 24). The setting looks like it has no control.
- **Fix:** Give the off track a neutral-300 fill (or a `border-strong` ring) and a tactile thumb shadow, so off reads as a control.
- **Skill rule:** make-interfaces-feel-better (pressable affordance); token-rewrite (depth).
- **Effort / impact:** S / Med.

### 23. Uppercase eyebrows and 11px table headers

- **Where:** [resources-root.tsx:362](../apps/web/core/components/summon/resources/resources-root.tsx:362) (`text-[11px] uppercase`) and [category-cards-row.tsx:119](../apps/web/core/components/summon/resources/category-cards-row.tsx:119).
- **Fix:** Sentence-case, 12px medium tertiary labels, matching the rest of the app.
- **Skill rule:** haloai-profile (quiet sentence-case labels, not uppercase eyebrows); hierarchy-density-and-phone §5 (no text below 12px).
- **Effort / impact:** S / Low–Med.

---

## B. Summon screens

### 8. Always-open create forms docked beside lists

- **Where:**
  - Clients: Add client rail ([clients/page.tsx:85,126](<../apps/web/app/(all)/[workspaceSlug]/(projects)/summon/clients/page.tsx:126>))
  - Meetings: "Schedule meeting" and "Link Plane action item" ([meetings/page.tsx:91,118](<../apps/web/app/(all)/[workspaceSlug]/(projects)/summon/meetings/page.tsx:118>))
  - Automation: the generator column ([automation/page.tsx:375](<../apps/web/app/(all)/[workspaceSlug]/(projects)/summon/automation/page.tsx:375>))
- **What's wrong:**
  - A 22rem form with a full-width primary button sits beside every list, so the create action outweighs the data. With one client, the list fills a quarter of the page and the form fills the rest (screenshot 02).
  - On a phone the form drops below the list and doubles the page length (screenshot 33).
  - Meetings has two forms plus a UUID field (screenshot 06).
- **Fix:**
  - A header primary action ("New client", "New meeting") opens the form in the existing Base UI drawer: right side on desktop, bottom sheet below `md`.
  - "Link task" becomes a row action on a meeting, with a task combobox.
  - The list then gets the full width.
- **Skill rule:** ui-makeover §6 (side panels → native drawers); drawers ref §6 (phone placement); ui-makeover §7 (one accent CTA per view).

### 11. Credentials: docked detail column with a dead close button

- **Where:** [credentials/page.tsx:362-373](<../apps/web/app/(all)/[workspaceSlug]/(projects)/summon/credentials/page.tsx:367>). The "Close details" button has no `onClick`. A `CredentialDrawer` is already imported and used for editing (:531).
- **What's wrong:**
  - Half the page is a permanent "Credential Details" column showing "Select a credential to inspect." in a nested card (screenshot 11).
  - Its × does nothing.
- **Fix:**
  - Give the list the full width.
  - Selecting a credential opens the detail in a modal drawer with a backdrop. Credentials are sensitive, so they belong in the drawers ref's modal class.
  - Delete the docked column and the dead button.
- **Skill rule:** drawers ref §6 (sensitive panels are modal); guardrail on non-functional controls.

### 14. Home: clipped filter chips, and a phone layout that stacks two screens

- **Where:** the chip row ([home-root.tsx:123](../apps/web/core/components/summon/home/home-root.tsx:123)) and the selected-project detail ([home-root.tsx:250](../apps/web/core/components/summon/home/home-root.tsx:250)).
- **What's wrong:**
  - The four chips overflow the about 300px left column at 1440px ("Opportunities" is cut off, screenshot 01). On a phone they clip with no hint that more exist.
  - On a phone, the selected project's whole workspace panel (header, CTA, tabs, cards) stacks below the feed, so Home is two screens long (screenshot 31).
- **Fix:**
  - Use a segmented control for the four fixed filters. The `Tabs` contained variant with icons fits the space.
  - On a phone, tapping a row navigates to the project, or opens a bottom sheet. Don't render the detail panel inline.
- **Skill rule:** hierarchy-density-and-phone §3 (chips that run out of room → segmented or select) and §10.

### 16. Information architecture: duplicate surfaces

- **What's wrong:**
  - Documents is titled "Documents & Knowledge Base" next to a separate Knowledge page (screenshots 07, 08).
  - Resources' "Quick Access" list repeats its own seven category tiles (screenshot 09).
  - Notifications duplicates Plane's inbox and links to it ("Open Plane Inbox", screenshot 12).
  - Reports and Plane Analytics both cover project numbers (screenshots 13, 30).
- **Fix:**
  - Rename Documents to "Documents".
  - Drop Resources' Quick Access (the tiles already filter).
  - Decide whether Summon Notifications replaces the inbox or links into it, and whether Analytics moves under "Advanced Plane".
- **Effort / impact:** L (needs a product call) / High (fewer nav items, less "where do I go?").

### 19. Project detail: a toolbar that looks like tabs, and status as plain text

- **Where:** the project header's quick-create band and the Tasks tab rows ([project-detail-tabs.tsx:52-59](<../apps/web/app/(all)/[workspaceSlug]/(projects)/summon/projects/[projectId]/project-detail-tabs.tsx:56>)).
- **What's wrong:**
  - "Milestone · Document · Meeting" is a second horizontal band above the real tabs and reads as a tab row (screenshot 16).
  - Task rows show the state as grey text plus a grey "Open"/"Completed" pill, even though `StatusBadge` exists (screenshot 17).
  - The tab isn't in the URL, so a reload returns to Overview.
- **Fix:**
  - Fold quick-create into a "New" split menu beside "New task".
  - Rows use `StatusBadge` plus a trailing chevron.
  - Put the tab in the search params.
- **Skill rule:** selection-and-motion §5; hierarchy-density-and-phone §7 (row affordance).
- **Effort / impact:** S–M / Med.

### 20. Automation Studio: clipping rows and empty-state order

- **Where:** the template grid ([automation/page.tsx:344](<../apps/web/app/(all)/[workspaceSlug]/(projects)/summon/automation/page.tsx:344>), `xl:grid-cols-6`) and the generated-documents tabs and table.
- **What's wrong:**
  - Template titles wrap to three lines at 1440px.
  - The tab row is cut off at "Te…".
  - The table header renders _below_ "No records yet."
  - The search placeholder is truncated (screenshot 10).
- **Fix:**
  - Use 4 columns at `xl` with titles on one line.
  - Tabs follow #6.
  - Render the empty state inside the table body, under the header.
- **Effort / impact:** S–M / Med.

### 22. Opportunities: phone filters and placeholder glyphs

- **What's wrong:**
  - On a phone the stage chip row clips (screenshot 32).
  - Rows end in "—", "0%" and a "–" avatar bubble when there is no value or owner (screenshot 03), which adds noise to every row.
- **Fix:**
  - Use a stage select on a phone.
  - Hide empty value, probability and owner slots instead of rendering dashes. Show "Unassigned" once, in the detail.
- **Skill rule:** hierarchy-density-and-phone §5.
- **Effort / impact:** S / Med.

### 25. Assistant: box-in-box and mixed language

- **What's wrong:** The chats rail empty state is a card inside a card. The welcome is in Indonesian. The header says "Automatic RAG" (screenshot 15).
- **Fix:** Follow #12 and #13.
- **Effort / impact:** S / Low–Med.

---

## C. Inherited Plane screens

### 1. "Manage features" leads to a 404 (functional)

- **Where:** five disabled-feature pages push `/${workspaceSlug}/settings/projects/${projectId}/features`. Only `/features/{cycles,modules,views,pages,intake}` exist in [routes/core.ts:314-331](../apps/web/app/routes/core.ts:314). The call sites:
  - [cycles (list)/page.tsx:84](<../apps/web/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/cycles/(list)/page.tsx:84>)
  - [modules (list)/page.tsx:77](<../apps/web/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/modules/(list)/page.tsx:77>)
  - [views (list)/page.tsx:80](<../apps/web/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/views/(list)/page.tsx:80>)
  - [pages (list)/page.tsx:68](<../apps/web/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/pages/(list)/page.tsx:68>)
  - [intake/page.tsx:56](<../apps/web/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/intake/page.tsx:56>)
- **Reproduced:** Cycles → "Manage features" → "404 - Page Not Found" (screenshots 21 → 23).
- **Fix:** Push to `/features/<feature>/` for each page. Better still, put an inline "Turn on cycles" switch in the empty state (see #12), which removes the trip to settings.
- **Effort / impact:** S / High.

### 2. Creating a cycle fails with "Error in creating cycle" (functional)

- **Where:**
  - `CycleForm` builds `useForm` defaults with `project_id: projectId` ([cycles/form.tsx:55](../apps/web/core/components/cycles/form.tsx:55)) on its first render.
  - At that point `CreateUpdateCycleModal` still passes `activeProject ?? ""`. The effect that sets it runs afterwards ([cycles/modal.tsx:159-178](../apps/web/core/components/cycles/modal.tsx:159), passed at :186).
  - `payload.project_id ?? projectId` ([modal.tsx:50](../apps/web/core/components/cycles/modal.tsx:50)) doesn't catch `""`.
- **Reproduced:** "Set your first cycle" and "Add cycle" both open the form with the project chip unset. Submitting posts to `/projects//cycles/` → 404 → toast "Error in creating cycle", and the typed title is lost (screenshot 25). It works only after picking the project by hand.
- **Fix:** Pass the route's `projectId` as the initial `activeProject`, or `reset()` the form when `projectId` changes. Treat `""` as missing. Module creation may share this pattern (UNVERIFIED).
- **Effort / impact:** S / High.

### 10. Work-item rows and cards show 5 empty bordered property boxes

- **Where:** list and board properties ([issue-layouts/properties/all-properties.tsx](../apps/web/core/components/issues/issue-layouts/properties/all-properties.tsx)). Screenshots 18, 19, 34.
- **What's wrong:** Every row and card renders bordered icon boxes for priority, start date, due date, assignee and labels, even when empty. In the list the property column is louder than the titles. On a board card it's a whole extra row of noise.
- **Fix:**
  - Hide empty properties on cards.
  - Show empty slots only on hover or focus, as borderless tertiary icons.
  - Keep filled values as icon chips. Display settings can still force them on.
- **Skill rule:** hierarchy-density-and-phone §5 (an icon appears only where it marks something).
- **Effort / impact:** M / Med–High (the most-used Plane screen).

### 21. Phone work-items toolbar

- **Where:** [mobile-layout-selection.tsx](../apps/web/core/components/issues/issue-layouts/filters/header/mobile-layout-selection.tsx) and the issues header.
- **What's wrong:**
  - The "Board" dropdown is clipped at the left edge.
  - "Display" is a framed button while "Analytics" is bare text at a different height.
  - The breadcrumb collapses to "…" (screenshot 34).
- **Fix:** One row of equal-height controls: a layout select, a filter icon button, and an overflow menu for Display and Analytics.
- **Skill rule:** hierarchy-density-and-phone §3.
- **Effort / impact:** M / Med.

### 24. Header actions stay live while the feature is off

- **Where:** [cycles (list)/header.tsx:72](<../apps/web/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/cycles/(list)/header.tsx:72>). Modules has the same header.
- **What's wrong:** With Cycles off, the header still shows Search, Filters and "Add cycle" above the "not enabled" state (screenshot 21).
- **Fix:** Hide the header actions while the feature is off.
- **Skill rule:** guardrail "never make non-functional controls look functional".
- **Effort / impact:** S / Low–Med.

### Smaller inherited issues (not ranked)

- **Cycle detail side panel** (screenshot 27): reads "0 Work item" and "No Data yet", and the "Progress" box is empty. Pluralize, use sentence case, and use the empty primitive.
- **Profile settings** (screenshot 29): the form floats in the middle of a large empty area under a "Change cover" button with no cover. The selected nav item is grey (see #9).
- **Analytics tabs** (screenshot 30) use the contained segmented variant while every Summon screen uses underline. Pick one per level: segmented for view switches, underline for sections.

---

## What already holds up (no action)

- **Work-item peek:** the Base UI drawer slides in over the content area and keeps the board visible. On a phone a tap opens the full page, which is fine (screenshots 20, 35).
- **Real dark mode is coherent:** checked on Opportunities, Clients and the board (screenshots 38, 39). A first check flipped `data-theme` directly and showed white selects; that was an artifact of bypassing the toggle, not a bug.
- **Main sidebar selection, sliding tab indicator and status badges** match the skill recipe.
- **Propel collapsibles and accordions already animate their height** ([collapsible.tsx:58](../packages/propel/src/collapsible/collapsible.tsx:58)).

## Not verified

- **Module peek and create:** not opened. I enabled Cycles only, created one temporary cycle, inspected it, then deleted it and turned Cycles back off.
- **The phone nav drawer's entry and exit motion:** not stepped.
- **Pages, Views, Intake and Stickies:** not visited.
- **Screens with real data volume:** the test workspace has 1 project, 1 client, 3 tasks and 5 opportunities. Density, long names and sticky-header needs on large tables are unverified.
- **Screenshot scale:** the files are about 800px-wide downscales of a 1440px viewport. Measurements above come from computed styles, not from pixels.
