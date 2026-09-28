---
"@elmeragroup/fuse": patch
---

`ThemeProvider` warns once about a coerced pinned segment in production. Before, it warned twice on
mount and again whenever a color-scheme option changed.
