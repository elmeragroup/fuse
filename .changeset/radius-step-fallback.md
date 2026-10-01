---
"@elmeragroup/fuse": patch
---

The radius rungs in `@elmeragroup/fuse/css` (`rounded-xs` to `rounded-xl`, `--radius-popover`) and the private corner classes read `--radius-step` with a `0px` fallback. A host that imports `fuse/css` without `themes.css` and keeps its own `--radius` now rounds every rung with that radius instead of getting an invalid `border-radius`. The package README documents what `fuse/css` changes in a host's Tailwind theme and how to keep your own tokens; the theming handbook page has the same recipe.
