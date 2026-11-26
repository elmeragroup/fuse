---
"@elmeragroup/fuse": patch
---

Lines, dots and thumbs drawn only by a background fill now show in forced-colors mode, such as
Windows contrast themes. Forced colors can turn such a fill into the color around it, so these marks
now paint in the `CanvasText` system color there:

- the `Separator` line, which `ButtonGroup.Separator`, `Toolbar.Separator`,
  `ActionBar.Separator`, `Sidebar.Separator`, `Field.Separator` and `Item.Separator` draw
- the menu separator in `Select`, `Combobox`, `Autocomplete` and `DropdownMenu`, and the line between pinned and
  other values in a `DataTableFilter` value list
- the `TimelineList` dot and connector
- the active `Tabs` underline in the `line` variant
- the `Switch` thumb, on and off, so the two states differ by the thumb's place and size
- the `Radio` dot, so the checked radio differs from the others
- the `Slider` fill, with an outline around the track. A disabled slider's fill takes `GrayText`.
- the `Carousel` indicator dots, current, other and hovered
- the `Tour.Beacon` dot. The beacon's pulse, which painted the page background over the dot
  there, is hidden in that mode.
- the `DataTableFilter` dot on a field row that already has a filter
