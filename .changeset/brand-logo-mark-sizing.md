---
"@elmeragroup/fuse": patch
---

A `size-*` class on a `BrandLogo` mark (`@elmeragroup/fuse/icons`) now sizes the artwork, also in
menu rows, select options and buttons. Before, a row or button drew the mark at 16px whatever the
class said, and outside a row the mark kept its artwork size. An unsized mark still takes the row's
or button's icon size, and elsewhere every `BrandLogo` mark keeps its artwork size. Before, the
`ngfi` and `fkse` marks stretched to the width of their container there.
