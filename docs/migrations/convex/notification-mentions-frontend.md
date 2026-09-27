# Notification mentions and focused comments

## Owner trace and bounded scope

The native recipient inbox already owned read/unread, archive/unarchive, snooze, current-ACL filtering, and bounded candidate pagination. Native comments already owned rich drafts, captured-revision edits, deletion and recovery. The inherited notification UI adds richer ownership filters; its profile notification preferences are email settings. This slice adds structured mention recipients, a mention-only filter, canonical comment targeting, and archived self-unsubscribe. Email preferences/delivery and assigned/created/subscribed filter parity remain pending.

The existing inbox layout and controls are reused. Mention selection is explicitly labelled **Mention people** beside the existing editor, not presented as inline rich-editor mention-node support. Draft HTML and selected typed IDs stay local with the original comment revision. Directory pagination and revocation cannot silently drop selected recipients; missing selections remain removable and visibly distinguishable.

## Navigation and permissions

A comment notification opens the canonical task/project and passes its comment ID. `comments.get` resolves that one authorized undeleted comment independently of the loaded page. A local error boundary shows unavailable/deleted content without replacing task navigation or an existing composer. The preview focuses/scrolls once when its canonical ID loads; subscription changes do not repeatedly steal focus.

Actual task navigation owners clear the comment selector when selecting another task or leaving detail. The notification route helper starts fresh parameters, and the existing saved-view task-link regression now checks stale-comment removal. Current task subscription capabilities govern subscribe/unsubscribe; archived subscribers can leave without exposing an invalid subscribe action.

## Verification

Two notification-target behavior tests and the cross-project/stale-comment task-link regression passed. Initial native web TS7 and scoped lint passed. Recipient names use the authorized name/email projection with a visible stable ID suffix fallback. The picker reads maxRecipients from the canonical policy and disables unselected choices at the cap while retaining removal. Scoped eighteen-file lint passed; final scoped web TS7 passed after the backend guest-access import fix. Primary Chrome acceptance remains required for mentions delivery/actor exclusion, mention-only filtering, older/deleted comment targets, preserved edit drafts, archived unsubscribe, and desktop/390px layout. Ten backend mention/inbox behavior tests passed. No dependency, deployment, or commit changes by this agent.

## Primary Chrome evidence

The primary verified an owner mentioning the guest on the guest-owned NSTAR-5 task, live delivery into Mentions only, and opening the exact authorized focused comment (`qh7636t3ffg7n9h6jrkcrk1d2x8f6hce`). Composer text and selected recipients survived closing the preview. No console errors were observed in that journey. Final 390px label/cap inspection remains pending.

Primary Chrome follow-up: final canonical email/name labels and 20-recipient policy rendered at 390px; selection remained usable, labels wrapped, document scrollWidth equaled390. Desktop comment/history layout inspected. Temporary viewport override cleared. Local development briefly loaded the new profile UI before its backend function deploy; reload after deployment recovered. This is not a production rollout test.
