---
"@elmeragroup/fuse": patch
---

An `Item.Root` with a `render` element inside `Item.Group` now keeps the rendered element's own
role. Fuse wraps it in a `role="listitem"` element, so a link item reads as a link inside a list
item. Before, `listitem` replaced the link or button role. The wrapper copies the `hidden` and
`aria-hidden` the rendered element ends up with, set on `Item.Root` or on the `render` element, so
a hidden item adds no list item or gap. An explicit `role` on `Item.Root` still replaces both and
skips the wrapper.
