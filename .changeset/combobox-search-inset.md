---
"@elmeragroup/fuse": patch
---

`Combobox.Content` now insets an owned search group with popup padding instead of a margin on the group, so a `w-full` search group (the `PhoneNumberField` country picker) no longer overflows and clips its right edge. Popups without a search group keep the menu family's single `p-1` list inset.
