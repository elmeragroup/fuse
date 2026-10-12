---
"@elmeragroup/fuse": patch
---

`ButtonGroup.Separator` runs the full height of a horizontal group and the full width of a vertical one. Before, it stopped 1px short at each end and left a notch of page background between the buttons. The pale default line hid the notch, but a darker or brand color showed it. A `bg-*` class on the separator now recolors it with nothing else to override.
