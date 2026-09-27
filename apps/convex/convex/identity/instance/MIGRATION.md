# Instance authority and roster

Production owner: identity/instance. Moved bootstrap and current membership projection out of deactivation; no deployed UI consumes their prior generated paths and no bootstrap was invoked. Deactivation imports the canonical instance guard.

Legacy license InstanceAdmin model only defines role20 Admin; InstanceAdminPermission accepts role>=15. Native exposes one admin role, paginated safe roster, existing verified-account grant by email, membership-ID/revision removal and final-admin preservation. Final-admin prevention is an intentional safety correction over inherited unguarded deletion. Concurrent removals read the same indexed roster range and serialize. Removing/regranting creates a new membership ID so old confirmations cannot remove the replacement.

Bootstrap remains internal operator-only, atomic and irreversible setup lock; no public first-user route, auto role inference, bootstrap invocation or credentials changes. Read-only configuration exposes initialized timestamp and existing provider availability only, never raw configuration, hashes, keys or provider account IDs. Availability is configuration state, not proven delivery/provider health.

Broader instance configuration writes, workspace management, telemetry, licensing/version status, SMTP migration and instance setup UI remain separate inherited features. No real roster/bootstrap/deactivation changes were executed. Account deactivation UI remains unmounted pending verified operator initialization on each host.
