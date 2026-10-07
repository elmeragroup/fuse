---
"@elmeragroup/fuse": patch
---

`Combobox.Content` now insets an owned search group 4px on each side with a width that fits inside the popup, so a `w-full` search group (the `PhoneNumberField` country picker) no longer overflows and clips its right edge. The List keeps the menu family's single `p-1` inset, with or without a search group.
