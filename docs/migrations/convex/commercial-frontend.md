# Commercial frontend slice

The `/core` workspace navigation now mounts Projects, Clients, and Opportunities.
Commercial modules are lazy-loaded. The provider and authentication boundary are
unchanged by this slice.

## Implemented owner boundaries

1. Clients: paginated authorized records, local filtering of loaded records,
   create/edit/delete, all client fields including external references, typed
   active-member owner selection, and contact create/edit/delete.
2. Opportunities: paginated records, loaded-record filtering and stage filtering,
   all editable commercial fields, explicit stage transitions, exact decimal
   strings, owner/client selection, and create/edit/delete.
3. Delivery: server-owned won/client prerequisites, atomic create-or-link mutation,
   reactive linked-project readback, and navigation to its task view.

Generated Convex function/result types own contracts. Dropdowns retain database
IDs from authorized query results or the existing typed record; raw form strings
are never cast to IDs. API validators remain authoritative. Every dropdown has
explicit pagination where its owner is paginated. List counts are not presented
as workspace totals.

Existing client card hierarchy, field controls, and opportunity stage labels and
colors informed the composition. Legacy `SummonScreen` was not imported because
its sidebar wrapper requires the Django/MobX tree. Commercial modules use the
existing Propel controls and design tokens directly.

## Review and verification

Web TypeScript 7 checks pass. Focused Oxlint reports no warnings/errors, and the
changed commercial components have classic cyclomatic complexity at most 10.
One typed form-initialization value replaces repeated nullable record fallbacks.
Contact editor state represents a single open editor, preventing simultaneous
create/edit flags. No test-only adapters or new dependencies were introduced.

The main run owns Chrome behavior/visual acceptance. Backend behavioral tests
exercise commercial authorization, validation, contacts, transitions, and atomic
handoff. No browser success or performance improvement is claimed here.

## Remaining parity

This slice does not implement global server search, workspace currency settings,
the full opportunity pipeline/inspector layout, client activity, related document
and meeting panels, financial records, or every existing detail tab. Filters are
explicitly limited to loaded records. Existing Django routes remain available;
this receipt does not authorize retirement.

## Primary Chrome acceptance

On the local authenticated /core route, created Northstar QA Client and its primary contact, then a won opportunity containing the exact amount 1234567890123456.78. Created QADEL from that opportunity and opened the resulting delivery project. The amount remained intact in rendered detail; the handoff replaced the create/link panel with the committed project. Client directory desktop screenshot was inspected. Following review, the explicit native Status label resolved uniquely through Chrome's semantic label locator.

Review fixed selection ownership: selected client/opportunity detail now reads its canonical generated get query, independently of loaded list pages. The paginated boundary scenario has source verification but has not yet been exercised with 51 clients in Chrome. Full mobile commercial acceptance and legacy inspector parity remain pending.
