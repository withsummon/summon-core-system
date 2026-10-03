# Native task links and reactions

Task detail lazily mounts native links and reactions only for readable, non-deleted tasks. Generated backend capabilities own edit controls, including archived read-only behavior and guest access. Deleted task recovery never mounts these queries.

Links support create, edit, removed-list, remove and restore. Opening an edit or lifecycle confirmation captures its revision. Live updates do not replace the approved draft; conflicts retain the draft for cancel/reopen. Editing title/URL omits opaque metadata so the canonical mutation preserves it. Links use safe new-tab attributes and backend HTTP(S) validation. Each tab has bounded pagination and no inferred global count.

Reactions reuse the existing EmojiReactionPicker decimal code contract and stringToEmoji renderer. Each loaded row identifies its actor; no aggregate is presented from a partial page. Picker selection sets the current actor's reaction active, rather than toggling from a potentially incomplete page. Only the current actor sees removal controls. Canonical backend idempotence and current access checks own writes.

The local draft regression verifies a concurrent row update cannot replace the captured revision/content and that editing omits opaque metadata. Backend reaction/link BDD belongs to tasks/**tests**/reactions-links.test.ts. Scoped frontend lint passes. Browser acceptance and actual deployment are separate primary-agent gates; not performed by this implementation agent. No link crawler, metadata fetch, comment reactions or legacy route retirement is claimed.

## Primary Chrome evidence

On local3010 NSTAR5, owner created example.com/migration-qa as Migration reference; canonical href became http://example.com/migration-qa without making an external request. Root changed the input to inputMode=url so inherited absent-scheme input reaches canonical validation; added existing URL/title bounds. Two-tab edit: owner saved Verified migration reference, peer stale save failed and retained Stale reference title. Remove hid the link live from the project guest; guest had no edit/removed controls; restore returned canonical link. Owner and guest added the same grinning-face reaction; each saw only their own Remove, and guest removal preserved owner reaction. This is local development acceptance; archive readonly is covered by BDD, not a browser claim. HMR from the subsequent comment-reaction slice interrupted the first concurrent-edit attempt; the repeated stable-UI attempt above passed.
