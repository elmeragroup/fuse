---
"@elmeragroup/fuse": patch
---

In forced-colors mode, `Calendar`, `RangeCalendar`, `DatePicker`, `DateRangePicker` and `DateField`
keep the system palette's colors:

- An enabled unselected day and an enabled date segment that is not focused now take the system
  text color the browser supplies. Before, they kept the theme's text color, which was
  unreadable when a host pins a light theme under a dark contrast theme, or the reverse (about 1:1
  against the forced background).
- A selected day that fails validation, and the selected start and end days of an invalid range, now
  paint the system `Mark` color with `MarkText`. Before, they kept the theme's error fill and error
  foreground. A valid selected day still paints `Highlight`.
- A range's selected middle days stay `Highlight` while the pointer is over them. Before, hover
  painted the theme's translucent range fill, which on an invalid range's `Mark` band measured
  2.17:1.
- A focused selected day shows a 2px outline in its text color inside its fill, in place of the
  theme's focus ring.

Normal-mode colors are unchanged.
