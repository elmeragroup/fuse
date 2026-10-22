---
"@elmeragroup/fuse": patch
---

A height or width in your `className` now wins on `Switch`, as a size utility already does on
`Button` and `Toggle`. Before, the track's size sat behind `data-size` selectors, so
`<Switch className="h-6">` changed nothing. The track caps its width at its size's, as `Checkbox`
does, so it keeps its size as a direct child of a vertical `Field.Root`. Pair a wider width with a
`max-w-*`, as in `<Switch className="w-11 max-w-11">`. Without a `className`, both sizes render as
before.
