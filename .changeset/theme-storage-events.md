---
"@elmeragroup/fuse": patch
---

`ThemeProvider` now follows `localStorage.clear()` from other tabs by restoring the configured `defaultColorScheme`, and ignores `sessionStorage` events that reuse the color-scheme key.
