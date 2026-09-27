# Intake discussion

## Legacy owner and native boundary

Legacy intake `components/inbox/content/issue-root.tsx` renders the shared
IssueActivity with isIntakeIssue. Registered issue comment CRUD and issue/comment
reaction routes in app/urls/issue.py use the existing IssueComment/Reaction tables.
Comment creation loads Issue.objects, not triage-excluding issue_objects: members
may comment; guests require their own submission or guest_view_all_features.
Comment changes require author or project administrator. Legacy comment/reaction
listing is broader project-member access; this native slice intentionally retains
canonical intake visibility instead of reproducing that disclosure boundary.

The shared tasks/discussion_access owner dispatches triage submissions to
requireIntakeTask and ordinary tasks to unchanged requireTask. General task lists,
read APIs, lifecycle and hierarchy continue excluding triage. Current intake
membership and creator/guest-feature rules apply to every discussion read/write.
Removed intake is hidden; accepted submissions retain the same task, comment and
reaction IDs, then follow ordinary task authorization. Archived ordinary tasks
remain discussion-read-only. Existing author/admin comment moderation, monotonic
CAS, soft removal/recovery and actor-idempotent reactions are reused.

## Notifications and storage

No parallel comment, reaction, subscription or notification table is introduced.
Mentions validate all recipients before insertion; subscription and delivery stay
atomic with existing events. Current discussion visibility owns delivery, list,
mark-read and direct notification changes. Removed/revoked intake hides retained
notifications/subscriptions without deleting their history. Explicit unsubscribe
requires current discussion access, matching ordinary subscriptions. After
acceptance the retained subscription continues and existing notification links
switch from intake to ordinary task destinations. Actor exclusion and subscriber
bounds remain unchanged. General task permission helpers are not broadened.

## Verification and limits

Five new module-owned BDD journeys cover creator/other-guest privacy and flags,
CAS/comment recovery and retained reactions, invalid target IDs, atomic rejected
mentions, removal/revocation, retained subscriptions, and acceptance identity and
notification routing, plus current-recipient checks on triage property events. Existing intake isolation assertion now verifies permitted
empty discussion while ordinary description/status/lifecycle remain denied.
Thirty-one focused tests and backend TypeScript 7 pass; scoped Oxc is clean.

No mail, public-board/PAT/REST compatibility, historical activity reconstruction
or migration of broader intake configuration is claimed. Browser acceptance and
backend deployment remain pending at this source checkpoint. The standalone
activity timeline still requires ordinary task access and is not mounted for
triage; historical/intake activity timeline parity remains explicit work.
