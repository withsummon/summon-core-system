# Private stickies frontend

## Experience and owner trace

The legacy sticky widget uses colored note cards and the sticky editor; its operations persist HTML independently of opaque editor data. Native `Stickies` keeps that private capture/reopen job, using the existing `STICKY_COLORS_LIST` and `TaskRichEditor` rather than a new editor/theme. Only the signed-in owner's notes are returned, including for guests; no administrator access to another person's notes is presented.

References inspected for this bounded screen:

- [Notion private note](https://mobbin.com/screens/fec09ec2-fba4-45b2-98ad-28e6366bd642): focused reading/writing surface with clear private context.
- [Notion gallery](https://mobbin.com/screens/0bd76f5f-9281-4d76-933e-cafe385ef965): aligned cards with identity and concise content. Adapted to text excerpts rather than unrelated cover imagery.
- A [Canva sticky board](https://mobbin.com/screens/f3ad3100-0e98-46ca-a806-56c0ccedb9a7) was inspected but rejected as the workflow reference: collaborative canvas positioning is not the private ordered-note task here. A narrower Notion gallery retry supplied the relevant collection pattern.

Permanent inline editing of every card was compared with grid → focused editor. The latter keeps note scanning compact, allows readable rich content at 390px, and gives stale-write conflicts an explicit place without resetting another card's draft. A list toggle is available. Primary Chrome will verify the actual composition.

## Public boundary

The workspace module is `module=stickies`. The `sticky` URL selector opens the canonical owner-authorized string resolver, preserving detail across reload/bookmarks without a raw ID cast. Module/workspace navigation clears the selector. Create and edit use explicit save. Edit and lifecycle actions retain captured `updatedAt`; reactive changes preserve the draft and surface a stale-revision message. Moving the note to Trash from another tab keeps the editing form mounted, shows its removed state, and lets the canonical save reject without discarding unsaved text. Updates send only name, HTML, and background color, preserving omitted JSON/binary/logo/text-color metadata. The UI renders only sanitized HTML and approved legacy palette keys, not opaque binary/JSON.

Search is explicitly labelled note text, matching the backend's derived-description search. Bounded pages expose Load more even after sparse search results. No total count is claimed. Active ordering is persisted descending order. Move earlier/later uses known adjacent positions; a needed unloaded boundary does not become a false end-of-list. Equal interior positions with no representable gap disable that move. Reordering is unavailable while text filtering hides intervening notes. Trash restoration retains original content, appearance, and position.

## Verification and remaining scope

Native web TS7, scoped five-file Oxlint, two module-local ordering regressions, and six backend sticky behavior tests passed. Owner peer review identified reactive deletion unmounting an unsaved draft; the editor now remains mounted and reports the removed state. The URL resolver preserves bookmarks and enforces the same owner/workspace boundary. Primary Chrome remains a separate gate. Chrome journeys: owner/guest private create, rich save/reopen, palette, search/sparse load more, two-note ordering, stale edit/Trash confirmation, remove/restore, account isolation, desktop and 390px grid/editor.

Legacy PAT/REST endpoints remain. Full inherited editor extensions, binary collaboration, inline attachments/mentions, text-color/logo editing, and data import are not implemented by this UI slice. Unknown appearance values remain stored until explicitly changed. No dependency, deployment, or commit changes by this agent.

## Primary Chrome acceptance

Local dev3010: created Private migration checklist (sd76nhrcv2k6s17t6qv2fxakgh8f67sv), light-blue appearance and rich text; URL survived reload after resolver deployment. Different-account deep link showed unavailable. With an edit draft open, a same-account peer moved the note to Trash: draft title persisted, save was rejected, cancel displayed the saved removed content, and restore returned it to active notes. Second note Ordering verification (sd7ac87z4cgchwpe5xjvabn6wn8f7vkg) proved persisted earlier/later ordering across reload. Text search returned only the matching note. Desktop grid and390px result/control layout inspected; scrollWidth390, viewport override cleared. Root removed a duplicated changed-revision notice when the more specific Trash notice applies. Initial HMR activation preceded the new resolver; no clean production-rollout claim from that transient failure.
