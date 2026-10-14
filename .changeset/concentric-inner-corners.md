---
"@elmeragroup/fuse": minor
---

Inner parts round concentrically with the surface they sit in: a part laid against a padded
surface's edge takes the surface's corner less the padding and border between them, never
below 0. Outer corners keep their rung.

Visible changes, by family:

- Menus: DropdownMenu, Combobox, Select and NavigationMenu rows. Internal rows round 2px
  (NavigationMenu 0px) instead of 6px, and external rows follow their brand's radius. A Select
  row outside a `Select.Group` rounds like the popup.
- Fields: InputGroup addon buttons and the phone country trigger round with the field corner
  less their inset, 5px dense and 9px comfortable (1px internal); the SearchField clear button
  with the field corner less 5px (1px internal); the DatePicker trigger with the field corner
  less 1px (5px internal); a kbd, Combobox chips, the chip remove button and date segments with
  the field corner less their deeper insets (0px internal).
- Tabs: the list pads 4px instead of 3px, and a trigger rounds with the list's corner less 4px
  (2px internal). The `line` variant keeps its corners.
- Frame: a panel in a Frame rounds with the Frame's corner less its 4px padding (2px internal),
  and so does a Table body in a Frame. Stacked panels keep their joined edges.
- Sidebar: in a floating Sidebar, menu buttons and group labels round with the surface's
  corner less 8px (0px internal), and menu actions 4px inside that. Other variants keep their
  corners.
- DatePicker presets round with the popover's corner less 9px (0px internal).
- An InputGroup addon that holds both a kbd and a button now insets like a button addon.

The new public `rounded-inner` utility rounds a custom row or block the same way. Card, Dialog,
Popover, Tooltip, Toast, Item, SelectionItem, Empty, the rounded Accordion items, the
standalone Calendar and the parts above publish the `--inner-corner` it reads; elsewhere it
rounds with `--radius`. An element with theme attributes, such as a `ThemeScope`, resets
`--inner-corner`, so a part in a nested scope rounds with that scope's radius.
