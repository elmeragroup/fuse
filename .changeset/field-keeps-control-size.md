---
"@elmeragroup/fuse": patch
---

A `Checkbox` or `Switch` that is a direct child of a vertical `Field.Root` now keeps its size when
the field sits in a container that sizes to its content. Before, the field set it to the field's
own width, so with no label a checkbox drew 2px wide and a default switch 18px. The field still
stretches its other children to its width. In a `Field.Group` at least 28rem wide, a `responsive`
`Field.Root` now also keeps a checkbox or switch at its size, as a horizontal one does.
