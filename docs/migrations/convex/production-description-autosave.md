# Existing production description autosave owner

This is a nonvisual repair under the existing Plane/Summon task and intake screens. The deployed production appearance remains the baseline; `/core` is a temporary migration QA surface. No Convex transport was wired into these production screens in this change.

## Owner and invariant

`DescriptionInput` owns a draft for one entity. The public component keys the inner observer by entity ID; its `DescriptionAutosave` instance retains that entity's submit callback. A pending old-entity flush cannot dereference a newly selected entity's callback. Clean remote values are accepted through the existing editor `value` synchronization (`setContent` without emitting an update); dirty/in-flight drafts are retained. The initial editor value also comes from the retained draft, preserving it if editability recreates the editor.

The existing 1500ms debounce remains. Saves serialize; acknowledging one submitted snapshot cannot acknowledge text entered later. A due save or unmount flush queues newer dirty content behind the active request, without duplicating the same snapshot. Failure retains dirty content, rejects queued automatic retries and does not retry on unmount. Another edit owns the next attempt. The shared status contract now includes `failed`: the existing indicator shows `Not saved` without a spinner, the input surfaces an error, and task/full-page/peek/intake reload warnings remain active.

Task-detail, peek and intake operation wrappers now rethrow after their existing error toast. `InboxIssueStore.updateIssue` rethrows after its existing optimistic rollback. The redundant React Hook Form controller was removed from the input: it had no independent validation or rendered DOM, and its duplicate form/dirty refs were replaced by the actual autosave owner. Editor composition, file/mention handlers, toolbar, classes and responsive structure are retained.

## Verification

Six module-local Node behavior tests exercise clean/dirty remote updates, edits during in-flight saves, serialization, failure with no automatic retry, entity switching and duplicate unmount flush avoidance. Native web TypeScript passes after rebuilding the changed shared types package. Oxc reports no warnings in the autosave/status/type owners. Four inherited operation/store files have the same30 `no-shadow` warnings in a HEAD-source baseline and the changed source; no new diagnostics. One baseline lint invocation outside its working directory triggered an Oxc ignore-path panic; rerunning with the isolated baseline as its working directory completed and produced the comparison.

No browser acceptance or backend wiring is claimed. The existing Django API still lacks the native content-token contract: this repair prevents local draft replacement/false acknowledgement, but does not itself add server-side concurrent-write protection. Root review sampled the keyed owner and shared failure state before commit. Browser acceptance under the retained deployed layout remains a separate gate.
