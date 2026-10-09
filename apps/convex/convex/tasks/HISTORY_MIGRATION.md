# Description history

`description_content.writeDescription` owns current HTML/plain text plus versions transactionally. Ordinary creation, plain changes, rich saves and intake submit/edit reuse it; existing callers retain authorization, task CAS and event ownership. Property-only saves preserve formatting and history. Equal sanitized HTML creates no history version.

The latest version coalesces for the same actor within 600 seconds of its last save, including exactly 600; each coalesce increments revision. Different actors or longer gaps append. This preserves the rolling window in `bgtasks/issue_description_version_task.py`, while native snapshots commit atomically instead of later Celery reads. New tasks have initial history. Existing tasks start history on their next content change; past versions are not fabricated.

`tasks.history` provides capabilities, paginated metadata, scoped detail and restore. Restore takes version ID/revision and current task timestamp; intake additionally requires bridge timestamp and creator/admin permission. Stored HTML is restored through the same writer, including normal rolling coalescing; browser HTML is not trusted. Version CAS protects mutable coalesced previews.

Legacy history handlers in `app/views/issue/version.py` and `app/views/intake/base.py` restrict project guests to own task history unless guestViewAllFeatures is enabled, without a workspace-admin override. Native preserves this and treats workspace guests as guests too. Ordinary task visibility now uses the same canonical guest creator/view-all predicate as history. Intake additionally requires current bridge visibility. Deleted tasks/removed intake deny history. Archived ordinary history can be read but not restored; existing intake access rejects archived tasks. Acceptance retains task ID and shared history.

HTML/plain text only. Legacy JSON/binary, diffs, actor display-name enrichment, historical import and REST/PAT/public boundaries remain omitted. Legacy routes stay registered. No deployment or browser acceptance is claimed here.

Module-local history tests cover rolling boundary/no-op, distinct actor append, successful restore, version/task/bridge CAS, cross-task ID denial, guest flag/revocation/deletion, archived restore denial, sanitized intake creation and acceptance identity. Backend gates are separate from browser verification.
