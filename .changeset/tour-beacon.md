---
"@elmeragroup/fuse": minor
---

Adds `Tour.Beacon` to `@elmeragroup/fuse/tour`: a small dot beside a feature that starts a tip when
pressed. The beacon is the element of the tip's step, so `Tour.Popup` points at it, and it announces
`aria-haspopup="dialog"` and `aria-expanded`. It renders nothing until storage answers and nothing
once the tip is completed or dismissed, so a finished tip never flashes on load. Its pulse runs three
times and only when the user allows motion.
