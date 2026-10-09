# Remote QA frontend checkpoint 82f2f63e03

This is a local production build connected to the staged remote Convex backend, not the public frontend cutover.

- Source: `82f2f63e039ee55c82a7491db082b17f055e7020`.
- Served URL: `http://127.0.0.1:3024/core`.
- Build output: `/tmp/summon-production-82f2f63e03-remote`, 1,257 files.
- Tree SHA256: `6d421db15ec77e4b6bf57f30de5711dec16213c3ad3408947e122f5a68f8898c`.
- Index SHA256: `38845b37fb938ca0a6113429515e7d6263a0e19221eaa5b69b86d24dc3a8a463`; independent HTTP 200 read matched.

The build preserved unrelated editor/UI manifests and lockfile. The editor binary includes unmounted duplicate helpers, captured in `/tmp/summon-migration-control/checkpoint-82f2f63e03-editor-source.patch`, SHA256 `4b656caee21830af457776a0ec6941ad8b0b755389b203a67b523eccee3820ee`. This artifact must not be described as a clean commit-only build. Remote live document collaboration was not configured in this artifact.

## Onboarding and restart acceptance

The existing remote QA account had no profile. Chrome displayed onboarding, saved display name “Remote migration QA”, allowed selection of its existing workspace and completed setup. Desktop and 390×844 views had reachable controls; temporary viewport overrides were cleared. The full incoming deep link was preserved:

`http://127.0.0.1:3024/core?workspace=remote-browser-check-20260927&module=projects&project=RQA&task=r5794cy1z38mg8ba6kp0nch6458f75t3`

The destination rendered RQA-2 “Remote draft file publication”, its description, Start after RQA-1 relationship and text attachment. No new account or role was created. After the staged backend's targeted restart, root hard-reloaded this exact link and observed the same authenticated data again. This verifies recovery of the checked records, not a complete database integrity audit.

## Superseded QA servers

Eleven obsolete agent-owned static servers on ports 3012–3020, 3022 and 3023 were stopped after exact PID/command checks. Artifacts remain on disk. Receipt: `/tmp/summon-migration-control/retired-qa-servers-82f2f63e03.json`. Development servers 3010/3021, user port 3000, Django and PostgreSQL were left running. Their retirement remains subject to full feature and deployment acceptance.
