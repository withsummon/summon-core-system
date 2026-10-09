# Native relationship directions

The existing task relationship form now exposes all ten canonical directions: blocks/blocked by, relates to, duplicate, start before/after, finish before/after, implemented by/implements. Both selector options and read labels use the generated public direction union.

The client-side blocked-by endpoint reversal is deleted. Every submission sends the current task, chosen task and each captured revision unchanged, together with the selected direction. The backend relationship owner performs canonical reversal, symmetric ordering, duplicate validation, blocking cycle checks and authorization. No parallel relation store or client graph validation is introduced.

Candidate tasks retain the existing bounded same-project query, current ACL and Load more behavior. Hidden/deleted relation placeholders and cleanup remain unchanged. Cross-project relationships are a separate closure and are not claimed here.

Backend module BDD covers new direction/inverse storage and lifecycle behavior. Native web TS7 and scoped Oxc pass; all 39 native frontend tests pass. Primary browser acceptance remains pending. Browser acceptance should add an inverse direction from the current task, open the counterpart and verify its forward label, then remove it; verify all option labels, stale-version errors and guest read-only controls.
