---
"@elmeragroup/fuse": minor
---

Curated Phosphor icons now follow the same accessible-naming contract as bespoke artwork: pass `title` to render `role="img"` with a `<title>`, or omit it for a decorative icon (`aria-hidden="true"`, `focusable="false"`). `ElmeraIconProps` gains `title` and drops Phosphor's `alt`.

Migration: replace `alt` with `title`. Icons named with `aria-label` and no `title` are now hidden; pass `title` instead. `Alert.Icon` accepts neither `alt` nor `title`: its status glyph is always decorative, and the alert's text names the status.
