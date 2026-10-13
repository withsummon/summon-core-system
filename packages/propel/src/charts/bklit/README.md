Vendored from Bklit UI (https://github.com/bklit/bklit-ui, MIT, see LICENSE) via its shadcn registry
(https://ui.bklit.com/r/{name}.json), upstream main at f7b3bd2999 on 2026-10-13.

Local changes, applied mechanically on import:

- `@/lib/utils` -> propel's `cn`; `motion/react` -> `framer-motion` (same package family).
- shadcn tokens (`--foreground`, `--border`, `bg-muted`, ...) -> Summon design tokens; `--chart-*` and
  `--legend-*` are defined in `packages/tailwind-config/variables.css`.
- Tooltip panel uses the propel tooltip finish (hairline border, overlay shadow).
- `RingCenter` calls a `children` render function in the idle state too (aggregate data), so callers can
  show a value that is not the sum of the rings.
- Stacked `Bar` rounds the outermost non-zero segment of each row, not only the last series, so rows whose
  top series is 0 (and one-series-per-category bars) keep their caps.
- Ring tracks use `--chart-track`.
- Stacked horizontal `Bar` widths span `offset..offset+value` (upstream used `scale(value) - scale(offset)`,
  which is negative for every segment after a larger one).

Import public pieces from `@plane/propel/charts/<chart>`, not from this folder.
