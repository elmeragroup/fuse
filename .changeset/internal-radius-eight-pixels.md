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

The `GridList` selection box now caps at 4px in every theme too, as the `Checkbox` does. It was
6px internally. In external themes it took `rounded-xs`, so it now drops from 6px for Fjordkraft,
Fjordkraft Företag and Telinet and from 10px for TrøndelagKraft. It rises from 2px for
Gudbrandsdal Energi and from 0px for Elmera and Nordic Green Energy. The rest of the external
corners do not move.
