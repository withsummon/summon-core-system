# Commercial backend slice

## Owner review

The public boundary is generated Convex client/contact/opportunity mutations and delivery.start. Workspace membership owns commercial access; separate project-admin membership owns delivery links and profiles. Workspace administration never bypasses a project's membership boundary.

The handoff invariant is one delivery project per won opportunity, matching its client. The existing project creation owner was extracted to projects/create.ts and reused inside the same transaction. Concurrent retries must not leave an orphan project or duplicate grant. Monetary amounts remain Decimal(18,2) strings without Number conversion.

Review sampled the actual mutation, project creator, reference validators and behavioral cases. The primary verification ran 71 backend tests across seven files, including 26 commercial cases. Cases cover concurrent handoffs, rollback, cross-workspace references, revoked membership, exact decimals and project-admin isolation. Native TypeScript check passed. Chrome separately exercised client/contact creation, exact amount opportunity creation, create-delivery and opening the resulting project.

## Remaining parity

This is an additive replacement path; Django commercial routes remain for the legacy UI. Native saves intentionally accept the full record rather than partial REST bodies. Notes and descriptions now have a 100,000-character bound. Validation does not claim byte-for-byte Django validator equivalence. Client activity/document/meeting aggregates and the complete legacy inspector are not retired by this slice.
