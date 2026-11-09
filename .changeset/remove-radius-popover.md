---
"@elmeragroup/fuse": minor
---

**Breaking:** `@elmeragroup/fuse/css` no longer defines the `--radius-popover` theme variable or its
`rounded-popover` utility. No Fuse component read it: Fuse popups round with `rounded-md`. Use
`rounded-md` to match them, or declare the old rung in your own `@theme inline` block, as Fuse did,
so a nested theme's radius still reaches it:
`--radius-popover: calc(var(--radius) - 4 * var(--radius-step, 0px));`.
