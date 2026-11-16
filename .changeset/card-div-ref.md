---
"@elmeragroup/fuse": patch
---

`Card.Root`, `Card.Header`, `Card.Tag`, `Card.Action`, `Card.Content` and `Card.Footer` now type
`ref` as a `div` ref. React 19 already passed a `ref` through to the `div`, but the props type left
it out, so `<Card.Root ref={ref} />` failed to compile.
