# Native document export

## Owner and inherited contract

The registered Django page URLs and views contain no export endpoint. The inherited browser owner is `core/components/pages/modals/export-page-modal.tsx`, supported by `useParseEditorContent`, the shared `PDFDocument`, and `@plane/utils` Markdown conversion. It exports the editor's current HTML, rather than requiring a persisted revision. PDF supports A4, A3, A2, Letter, Legal, and Tabloid; Markdown and Everything / No images are also retained.

The native editor captures current body and title at preparation time. A fresh authenticated document read before capture and after conversion checks current access, including No images exports. Readable locked and archived documents remain exportable. PDF titles are DOM text nodes; filenames contain only ASCII letters, numbers, hyphens, and underscores.

## Reuse and authorization

`preparePdfHTML` owns the existing structural transformations for mentions, code, images, checkboxes, issue embeds, and table colors. The inherited hook now supplies its existing mention and image resolvers; its original failed-image fallback is preserved. Native export supplies the canonical document-bound asset reader and never fetches arbitrary image source URLs. Missing, foreign, revoked, and unfinished image references fail explicitly. No images removes both custom image nodes and normal images.

Authorized bytes become portable data URLs, without bearer tokens, temporary blob URLs, or authenticated source paths in the file. Reads are sequential and bounded to 100 distinct images and 32 MiB before data-URI retention. The shared transfer owner aborts reads and releases download URLs on close/replacement. The prepared download remains available through an explicit link; no arbitrary revocation timer races the browser download.

Native mention-directory rendering is still absent; native export preserves a visible `@Unavailable mention` marker instead of guessing names. Issue embeds follow the inherited omission. This slice adds no dependencies or backend endpoint, and does not retire Django.

## Verification

- Native web TypeScript 7 passes.
- Scoped Oxc reports no warnings or errors. Exact classic complexity peaks at 8 (`exportContent`); shared PDF adaptation is 5.
- Independent agent source review sampled the export flow, canonical asset reader, and shared PDF adaptation without a blocking finding.
- All 47 native frontend behavioral tests pass, including three module-local behavioral tests verify exact portable image bytes, rejection of non-image bytes, and cancellation before output.
- Source provenance review: inherited PDF transformations moved intact into the shared pure owner. Caller-specific mention lookup and image-error behavior remain in the inherited hook; only image scheduling changes from parallel to sequential. Markdown's inherited owner is reused.
- Browser download, PDF rendering, image omission, and narrow-panel visual acceptance are pending the primary agent's Chrome QA. Node tests do not establish browser DOM conversion or visual parity.

## Root download and rendered acceptance — 2026-09-27

Chrome exported the image-bearing Delivery collaboration verified document on local development 3010 and the fixed production artifact at 3025. First lazy PDF imports caused development panel resets, correlated with Vite optimized dependency timestamps; the warmed retry succeeded. Production first-load preparation succeeded without a reset.

Production source: `d330786578873c78df84e7e63c502a9878bb754f`; `/build-identity.json` independently read back this source and local backend 3210/site 3211/live 1235. Index SHA256 `624050914134b9141b6e6c7f174ec6017be507707de38a33eeba9339ad0460ad`; tree SHA256 `9833d2f01dd4769fff993339b88b6c47452b425aabcdcacffeba0611745f07eb`. Existing unrelated dependency edits were preserved and recorded with hash `2dff1c4d17cdd96cedae19ddcb4713b1cbb6759b42407c7a83bbd466d35067fd`; this is not a clean-dependency or public deployment claim.

- PDF Everything: downloaded 10,816 bytes, one A4 page (595.28×841.89 pt). Poppler render showed title, original low-resolution image and body without clipping/overlap. Production and development rendered PNG bytes matched, SHA256 `15b1e358983aeaba6278e3bf88cc87bdca541be275518f26573b9cdfe6984325`.
- PDF No images: downloaded 7,976 bytes, one Letter page (612×792 pt). Render showed title/body and no image.
- Markdown Everything: downloaded 4,200 bytes with one embedded PNG and body text, no credential marker, temporary blob URL or remote URL. Decoded image SHA256 `a6a26aec88756d439d42cab920919430e40e4e165ab5ab7adc843b9a4d93126f`.
- Markdown No images: downloaded 70 bytes, body retained and no embedded image.

Downloads remain in the user's Downloads folder as `delivery-collaboration-verified*`; rendered QA images are `/tmp/summon-migration-control/document-export-{a4,production-a4,letter}.png`. This acceptance samples A4/Letter and the simple image/body fixture; other paper sizes and rich structures are not claimed browser-verified by this receipt.

Root follow-up found that changing export options left the previous download link visible. Format, paper size and content changes now invalidate the prepared download through the existing object-URL cleanup owner. Chrome verified that switching a prepared Everything export to No images removes the old download link. Scoped Oxlint/Oxfmt pass. This follow-up is newer than the fixed 3025 artifact and was checked on development 3010.
