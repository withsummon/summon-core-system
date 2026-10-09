# Native account sessions

Account details exposes a bounded session inventory only when Manage sessions is opened. Each page reads ten canonical records and uses server cursors for Previous/More navigation; no global total or device identity is fabricated. The UI shows current-session identity, a short nonsecret distinguishing suffix for other sessions, creation time and expiration time.

Confirmation captures the selected typed session ID. The revoke mutation owns authorization and refresh-chain deletion; its returned `revokedCurrent` triggers the existing Convex Auth signOut owner. The UI renders the backend's revocation notice, so an additive deployment's JWT grace behavior is not mislabeled as immediate revocation. The separately coordinated canonical SessionBoundary handles revoked access JWTs after its owner deployment.

Verification: scoped Oxc and native web TS7 pass. Canonical backend session BDD covers receiver ownership, refresh-chain deletion, current/expired/mismatched denial, capacity atomicity and immediate authorization after the separate owner closure. No new test-only UI abstraction was introduced. Primary Chrome acceptance is pending: two independent sign-ins, list safe metadata, cancel another-session revocation, confirm it and observe its actual runtime boundary, then self-revoke/sign-in recovery; verify at 390px.

This does not add device, IP, browser, location or last-active metadata that the canonical session store does not capture. No real-user session was revoked by this implementation agent.

Primary Chrome acceptance against local backend456a8515f2: ending the current synthetic session returned both same-origin clients to sign-in. After fresh sign-in, a separate port3021 inherited-stickies session was created, identified by its UI creation time, and ended from port3010. Port3021 immediately replaced protected note content with Sign in again, and Continue to sign in reached the password form at the unchanged deep link. The controlling port3010 session stayed authenticated. No real-user sessions were changed. Both local and remote backends were deployed from the exact456a8515f2 archive; public frontend rollout is still pending.
