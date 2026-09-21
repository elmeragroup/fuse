---
"@elmeragroup/fuse": minor
---

`@elmeragroup/fuse/theme` now exports `COLOR_SCHEMES`, the `["light", "dark", "system"]` axis
tuple. Hosts and pickers can iterate the color schemes from the library instead of
re-deriving the list.
