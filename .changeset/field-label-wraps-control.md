---
"@elmeragroup/fuse": minor
---

`Field.Label` now owns the row treatment when a `Checkbox` is its direct child: the row centers and
shows a pointer cursor, so demos no longer restate `items-center cursor-pointer`. The label keeps the
shared heading weight; a `font-*` class in your `className` merges last and wins as on any other
label. A label beside a control (the `Field.Root orientation="horizontal"` pattern) is unchanged.
