---
"@elmeragroup/fuse": minor
---

Menu rows round concentrically with their popup: a row's corner is the popup's corner less the
padding between them, never below 0. DropdownMenu, Combobox, Select and NavigationMenu rows
change. Internal rows now round 2px (NavigationMenu 0px) instead of 6px, and external rows
follow their brand's radius. A Select row outside a `Select.Group` rounds like the popup.

The new public `rounded-inner` utility rounds a custom row or block the same way. Inside these
popups it reads the `--inner-corner` the popup publishes; elsewhere it rounds with `--radius`.
An element with theme attributes, such as a `ThemeScope`, resets `--inner-corner`, so a part in
a nested scope rounds with that scope's radius.
