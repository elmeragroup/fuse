---
"@elmeragroup/fuse": patch
---

`Sidebar`: collapsed to the icon rail, a `floating` or `inset` panel is now as wide as the gap that
holds its place, 64px at the default `--sidebar-width-icon`. It was 2px wider, so its surface drew
2px too wide with uneven margins, and a floating panel's container covered 2px of the adjacent
edge of `Sidebar.Inset`. The surface is now as wide as `--sidebar-width-icon`, 48px by default,
with 8px on each side.
