---
"@elmeragroup/ui": minor
---

`Field.Label` now owns the row treatment when a `Checkbox` is its direct child: the row centers,
the label drops to normal weight and shows a pointer cursor. Demos no longer restate
`items-center font-normal cursor-pointer`. To change the weight on such a row, use the same
`has-[>[data-slot=checkbox]]:` prefix; a plain `font-*` class is outranked by the library selector.
A label beside a control (the `Field.Root orientation="horizontal"` pattern) keeps its medium
weight; only the wrapping row is normal weight.
