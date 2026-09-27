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
