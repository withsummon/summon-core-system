# Identity, membership, and task slice acceptance

Control artifact: `05f894b84bbde4e2474b82f17be7f4578bc15f14` for the unchanged Django API. The candidate is the first native Convex implementation; it has a smaller task contract and is not feature-equivalent to all Plane workflows.

## Owner-first review

The database mutation owns membership, task sequence allocation, and audit-event atomicity. Generated Convex functions own the client contract; URL selections resolve against authorized lists. Workspace membership never implies private-project access. Active membership and write role are checked on every query/mutation, including after revocation. Administrators cannot leave a workspace or active project without another administrator. Rejoining a workspace does not restore previously revoked project grants.

The review corrected caller-controlled pagination budgets, invalid/fractional page sizes, missing supported membership grants, and test helper placement inside the deployed functions directory. The browser review corrected the mobile task row so text spans the full row below identifier/status. Root dependency cleanup removes an unnecessary utilities-barrel import and defers the existing error UI. Convex owns one lazy client for the document lifetime; HMR disposes it.

## Verified

- Native TypeScript 7 frontend/backend checks; focused frontend/backend Oxlint without warnings; Oxfmt; 32 backend tests across four module-local test folders. Main run independently reran and read all 32 passing results.
- Real Password signup returns a JWT accepted by a protected query on local self-hosted Convex. No admin impersonation or `withIdentity` was used for this runtime check.
- Chrome at `127.0.0.1:3010/core`: signup, create workspace, create project, create task, status update. A separate signed-in user at `localhost:3010/core` initially sees no project, receives explicit workspace then project access, and sees the same task status update without reloading.
- Revoking project access removes the second user's task view reactively. Regranting guest access restores read visibility with task creation absent and status selection disabled.
- Desktop and 390×844 guest layout inspected. Initial squeezed title/description was corrected and re-inspected; content and controls are readable without horizontal overflow.

## Limits

This is a functional migration slice, not the final Summon product layout. Task filtering, assignment, dates, attachments, custom project states, documents, and other existing domain modules are not replaced. Browser rollback during a rejected optimistic mutation, long offline recovery, and production route traces remain to be exercised. The existing Django sign-in route rendered after the provider split, but full legacy regression acceptance remains pending.

Remote containers are healthy but owned DNS and public TLS remain unresolved; no remote application-function or deployment-success claim is made. Existing Django/Postgres remain available. No speedup ratio is claimed: the initial local benchmark compares richer Django responses with the smaller candidate contract.
