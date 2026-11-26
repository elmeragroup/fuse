---
"@elmeragroup/fuse": patch
---

The highlighted row of every list now shows in forced-colors mode, such as Windows contrast themes,
under the pointer and the keyboard alike. Before, every row of `Select`, `Combobox`,
`Autocomplete`, `Command`, `DropdownMenu` and the `DataTableFilter` add menu drew the same outline
box, so the highlighted row looked like its neighbors.

The highlighted row, a `destructive` `DropdownMenu.Item` included, now fills with the `Highlight`
system color and takes `HighlightText` for its text, icons, shortcut and check. A `Kbd` cap in a
`Command.Shortcut` drops its own background on the fill. The other rows no longer draw an outline
box in forced-colors mode.

`Select` and `DropdownMenu` move focus to the row, so a row the arrow keys reach keeps a keyboard
focus outline, now drawn in `HighlightText` inside the fill, in a menu opened by the keyboard or
the pointer. `Combobox`, `Autocomplete`, `Command` and the `DataTableFilter` add menu keep focus in
their input, so their rows show the fill only. A focused `Select` option that loses its highlight
while the pointer rests on the scroll arrow draws the same outline in `CanvasText`.

In forced-colors mode a disabled row sets its text in `GrayText` at full opacity. A highlighted
disabled row takes no fill and draws the outline in `CanvasText`. In `Combobox`, `Autocomplete` and `Command` the
arrow keys can highlight a disabled row while focus stays in the input, and the outline marks that
row too.

A row whose submenu or panel is open keeps the same fill while focus is inside it: an open
`DropdownMenu.SubTrigger`, an open field row in the `DataTableFilter` add menu, and an open trigger
in a vertical `NavigationMenu`. A sub-trigger or trigger that becomes disabled while it is open
drops the fill and shows its disabled face.
