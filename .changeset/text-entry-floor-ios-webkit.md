---
"@elmeragroup/fuse": patch
---

The 16px text-entry floor now also applies in iOS WebKit when it reports a fine pointer, so iOS Safari no
longer zooms into a focused dense field on that path. Before, the floor applied only under a coarse pointer.
The floor now applies when either condition holds: a coarse pointer, or a browser that supports
`-webkit-touch-callout`, which only iOS-family WebKit does. Desktops with a mouse, Windows touch laptops and
touchscreen Chromebooks report a fine pointer and keep 14px dense text. Tailwind-source consumers get the new
`entry-floor` variant from `fuse.css`.
