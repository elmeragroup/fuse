---
"@elmeragroup/fuse": patch
---

`fuse.css`: the RAC popover width clamp now reserves React Aria's `containerPadding` in pixels
(`calc(100vw - 24px)`) instead of `1.5rem`, which only matched the 12px gutter per side at a 16px
root font size — a smaller root left the popover wider than the positioning gutter allows.
