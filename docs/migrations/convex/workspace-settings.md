# Workspace settings owner

Legacy owner: SummonWorkspaceSettingsView and serializer, with workspace-admin-only writes. Native owner: settings.get/save, sharing requireWorkspace. The name and settings update in one mutation; unauthorized or invalid input commits neither. Reads return defaults without creating a row, unlike the legacy serializer's get-or-create side effect.

Preserved fields: name, immutable slug, organization size, timezone, industry, description, currency, workweek. Logo/assets and MCP connection status remain separate owners. Native full saves tighten currency to three uppercase letters, description to 100,000 characters, and validate timezone through the runtime IANA implementation rather than Django's pinned pytz list. These differences are explicit migration contracts, not claimed byte-for-byte parity.

Four module behavior tests cover defaults without writes, atomic save/rollback, administrator/member/guest/revoked access, duplicate workdays and invalid currency. Primary native typecheck passed. Actual local authenticated mutation and readback confirmed Asia/Jakarta is accepted by the self-hosted runtime. UI verification is recorded separately when the settings navigation is available.

Chrome acceptance: administrator saved Asia/Jakarta timezone, Technology industry and Monday/Friday workweek; committed values rendered immediately. A separate member session read the same values without an Edit settings action. Independent owner review found no settings ACL or atomicity issue.
