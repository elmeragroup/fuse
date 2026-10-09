---
"@elmeragroup/fuse": minor
---

`@elmeragroup/fuse/theme` now exports `DENSITIES`, the `["dense", "comfortable"]` axis tuple.
Hosts, pickers and test matrices can iterate the densities from the library instead of
re-deriving the list.
