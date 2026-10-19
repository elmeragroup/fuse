---
"@elmeragroup/fuse": patch
---

`PopoverInfoButton`'s popup now takes the button's `label` as its accessible name, defaulting to
the localized "More information". A `Popover.Title` in the content still names the popup instead.
Before, the popup opened as a dialog with no name unless the content held a `Popover.Title`.
