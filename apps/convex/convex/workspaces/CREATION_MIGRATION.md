# Preserved onboarding workspace creation

`WorkspaceCreateStep` and `CreateWorkspaceForm` in the production frontend collect name, slug and organization size. Native creation previously omitted organization metadata. `workspaces.index.create` now accepts an optional organizationSize and writes it through the existing settings validator in the same mutation as workspace creation and administrator membership. Invalid metadata rolls the entire operation back; no intermediate workspace can be selected.

`settings/values.ts` owns the existing metadata defaults and validation, extracted unchanged from `settings/index.ts`. Both settings updates and workspace creation consume it. Existing native callers legitimately omit organization size, retaining unset metadata semantics; no stored-data backfill or invented organization size is introduced. Existing required workspace metadataRevision and deletedAt remain initialized.

Verification: native backend TS7, scoped Oxc and 25 creation/settings/cycle tests pass (2 new creation BDD). The invalid-size case verifies no visible workspace is created and the same slug remains available for a subsequent valid creation. Preserved onboarding frontend is still under implementation behind a planned disabled ownership boundary. No deployment or browser acceptance is claimed here.
