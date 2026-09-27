# Production frontend checkpoint ae84433f63

## Artifact

Source `ae84433f6383600d69a7526bb913fdb9eb4b401d` built in production mode and copied to `/tmp/summon-production-ae84433f63-local`, served at `http://127.0.0.1:3026/core`. Root independently retrieved `/build-identity.json`. The 1266-file tree digest is `c5aa005c911ba9251aecbf0026039f2034d62c3f60789b167ac71bebc7e0d5c8` and index digest `5772c0c0450ee2c9b9d745ba76c0c77bc17b15ece71c91913a7ba0cd9e9aa81e`. Existing dependency manifest/lock edits were preserved, with patch digest `2dff1c4d17cdd96cedae19ddcb4713b1cbb6759b42407c7a83bbd466d35067fd`; this is not a clean-dependency build. Build log and manifest are `/tmp/summon-migration-control/mentions-production-build.txt` and `mentions-production-manifest.json`.

The artifact uses local Convex 3210, HTTP actions 3211, and live collaboration 1235. Local additive backend `cd4d5f5d85` includes the prior mention queries. Remote deployment is a separate unresolved gate. The project order chooser is present in source but deliberately unmounted pending remote backfill.

## Browser and export acceptance

Chrome opened the copied document deep link (`workspace=northstar-convex-qa&module=documents&document=md79zmrrzb3n3s80vtr2eynm2d8f7atw`) and signed in with the existing local QA account. The deep link survived authentication. The production editor displayed the saved member token as `@Northstar QA Owner updated`, together with the existing image and body.

First-load A4 Everything export completed without a development dependency reload. The downloaded PDF is 12,442 bytes, one A4 page (595.28 × 841.89 pt). Poppler rendering was visually inspected: title wraps cleanly, image is embedded, the resolved mention and body are readable, and nothing overflows. The original low-resolution image remains visibly soft when enlarged. Changing Content to No images removed the old download link immediately, verifying the prepared-export invalidation fix in production. No document content was changed in this production acceptance. Switching to the existing Workspace rename QA also rendered its authenticated logo beside the selected workspace name; the two unset logos retained initials. Desktop screenshot inspection confirmed the selected row and logo fit the sidebar.

This proves the identified local production artifact and selected journey. It does not prove remote deployment, full inherited parity, or Django retirement.
