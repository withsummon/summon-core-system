# Native document labels

The inherited PageLabel bridge associates documents with the shared label taxonomy. Native `documentLabels` reuses `taskLabels`, without changing the independent free-text `documents.tags` field. A document writer may select any currently readable project label in the same workspace; document project assignments do not impose an invented taxonomy restriction.

The bridge is indexed by document and document/label. Paginated current labels preserve continuation. A per-label assignment/removal mutation captures the document metadata timestamp and advances it monotonically, avoiding a full-array overwrite or a new label-count cap. Current document write permission, lock and archive status are checked. New assignments require current project read permission; existing inaccessible/deleted taxonomy IDs are returned without names and remain removable by an authorized document writer. No sharing, project, asset, or CRDT state changes.

The prepared detail UI offers project-labelled choices, explicit add/remove confirmation, bounded load-more controls, and retained conflict state. It reuses the existing workspace taxonomy directory and project label management. No new frontend permission model or MIME/content path is introduced.

Verification: three backend behavior tests cover non-document-project taxonomy assignment, unchanged tags/content/project scope, stale metadata rejection, unavailable-title masking and retained-link cleanup, locked edits, and foreign-workspace rejection. Backend/web TypeScript and scoped Oxc pass. The full backend run passed 439 tests before the additional foreign-workspace regression; that focused suite now passes all three tests. Browser acceptance and UI mounting await backend deployment.

Remaining parity: workspace-global taxonomy, broader shared-label management, document label filters, historical content versions, and inherited route cutover remain open. The current UI does not claim to implement these.

Root Chrome acceptance after e5709ccb89 deployment: opened Delivery collaboration
verified on local3010, selected Acceptance from NSTAR's shared taxonomy and
confirmed assignment. The document rendered Acceptance · NSTAR. Its content and
existing child link remained present. This verifies authorized assignment, not
new browser proofs of revocation/removal; those are module-local backend tests.
Root independently ran all three label behavior tests and reviewed list/set
current access, hidden-title projection and captured metadata revision.
