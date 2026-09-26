# Meeting UI acceptance

The generated meeting APIs own records, participants and explicit task relationships. The frontend reads selected detail from its canonical query, keeps paginated directory selection IDs, and derives write controls from current workspace and project roles. Review fixed inactive participants becoming impossible to remove, a task picker retaining a remotely changed project, and pending link completion clearing a newer selection.

Primary Chrome acceptance created Delivery acceptance meeting in Northstar Release, added the peer participant, stored agenda/notes, then explicitly linked the existing Verify delivery acceptance task. The peer's project-guest session rendered the meeting and linked task without edit/link controls. Changing the canonical task from done to in_progress in the owner session updated the peer meeting without reload. No task was created by scheduling or linking. Backend relationship tests separately verify duplicate rejection and unlink semantics.

The form uses browser-local date/time input. Summary generation, recording/transcript uploads, meeting reminders/invitations and exports remain outside this slice. Meeting selection does not yet survive a reload as a deep link. These are migration gaps, not completed legacy parity.
