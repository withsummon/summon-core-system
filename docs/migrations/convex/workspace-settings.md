# Workspace settings owner

Legacy owner: SummonWorkspaceSettingsView and serializer, with workspace-admin-only writes. Initial native owner: settings.get/save, sharing requireWorkspace. The current metadata owner is settings.metadata/update, described below. The name and settings update in one mutation; unauthorized or invalid input commits neither. Reads return defaults without creating a row, unlike the legacy serializer's get-or-create side effect.

Preserved fields at the initial slice: name, then-immutable slug, organization size, timezone, industry, description, currency, workweek. Logo/assets and MCP connection status remain separate owners. Native full saves tighten currency to three uppercase letters, description to 100,000 characters, and validate timezone through the runtime IANA implementation rather than Django's pinned pytz list. These differences are explicit migration contracts, not claimed byte-for-byte parity.

Four module behavior tests cover defaults without writes, atomic save/rollback, administrator/member/guest/revoked access, duplicate workdays and invalid currency. Primary native typecheck passed. Actual local authenticated mutation and readback confirmed Asia/Jakarta is accepted by the self-hosted runtime. UI verification is recorded separately when the settings navigation is available.

Chrome acceptance: administrator saved Asia/Jakarta timezone, Technology industry and Monday/Friday workweek; committed values rendered immediately. A separate member session read the same values without an Edit settings action. Independent owner review found no settings ACL or atomicity issue.

## Metadata revision and Chrome acceptance — 2026-09-27

Backend commits 36f7406b6d and 609594eaf8 introduce one metadata snapshot and a required revision; 994443acdb mounts the captured-edit UI. Name, mutable slug and settings commit atomically. The mutation validates the current revision and returns the canonical address. The previous no-CAS save and redundant get endpoints are now removed after current-consumer verification: the served port-3024 artifact and current development source use metadata/update, and obsolete static QA servers were retired. The remaining read/write owner requires a coherent settings snapshot and captured revision. Exact audit evidence is in `apps/convex/convex/settings/METADATA_MIGRATION.md`. Cleanup passed backend/web native TS7, 16 settings tests and scoped Oxc.

Root Chrome verification on local port 3010:

- Renamed a dedicated QA workspace address to `workspace-rename-qa-verified`; the route retained `module=settings` and sidebar links adopted the new address.
- A conflicting `northstar-convex-qa` slug was rejected and the draft remained editable; Cancel restored canonical values.
- Two tabs captured the same metadata revision. The second saved a new description. Saving the first tab's name draft rejected with “Workspace settings changed. Reopen settings before saving.” The name draft remained `Workspace rename QA stale draft`; Cancel showed canonical name `Workspace rename QA` and the second tab's description.

These checks establish address navigation, collision recovery and concurrent-edit protection. They do not establish full inherited settings parity or production cutover.
