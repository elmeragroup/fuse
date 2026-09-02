---
"@elmeragroup/ui": patch
---

The standalone `styles.css` is compiled from the emitted dist JavaScript alone: the build wrapper imports `tailwindcss/utilities.css` with `source(none)`, so utilities spelled only in tests or other unpublished source no longer reach the published sheet (23685 → 23491 gzip bytes).
