---
"@elmeragroup/fuse": patch
---

Internal themes now round with an 8px `--radius`, `0.5rem`, up from 6px. Cards, buttons, fields,
`Frame` and the other outer corners round at 8px. The rows inside menus, `Select` and `Combobox`
lists and `Frame` panels round at a concentric 4px instead of 2px. The `Checkbox` corner stops at
4px in every theme, so the 16px box does not round into a circle that reads as a radio. An
external `Checkbox` keeps its 4px corner. A `--radius` override above 4px no longer rounds the
`Checkbox` with it. To keep the 6px corners, set `--radius: 0.375rem` on the element that carries
the theme attributes.
