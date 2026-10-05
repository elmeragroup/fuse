---
"@elmeragroup/fuse": minor
---

`Item.Group` takes `variant="compact"` to draw its rows as one connected list. The group drops
its gap, rows take 12px padding (8px at `size="sm"`), and `Item.Separator` loses its vertical
margin. Outline rows share one border between them, and only the first and last visible rows
round their outer corners, so a `hidden` row at either end leaves the list closed. A row rendered as a link or button joins the list the same way. The
default variant keeps the spaced look.
