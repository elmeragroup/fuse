---
"@elmeragroup/fuse": patch
---

In a host without Tailwind's preflight, such as one that loads Fuse's standalone `styles.css` or
builds Tailwind without preflight, the check on a checked `DropdownMenu.CheckboxItem` or
`DropdownMenu.RadioItem` and on a picked value in the `DataTableFilter` value list sat 3px above
the center of its row. Both now render Base UI's indicator as one 16px `<span>` that holds the
Check directly, so the check sits at the center of its row in every host. The row's width and the
label's position do not change.

The DropdownMenu indicator keeps `data-slot="dropdown-menu-checkbox-item-indicator"` or
`data-slot="dropdown-menu-radio-item-indicator"`. Base UI mounts the indicator while the item is
checked or the value is picked and removes it once its exit transition ends, so an unchecked row no
longer keeps an empty indicator span.
