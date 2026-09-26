---
"@elmeragroup/fuse": patch
---

`ThemeScope` now validates its theme once per axis change, so a production pinned-segment warning no longer repeats on every render. `ThemeProvider` stays mounted where `matchMedia` is missing or only supports the legacy `addListener` API.
