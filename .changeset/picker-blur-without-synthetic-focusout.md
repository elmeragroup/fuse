---
"@elmeragroup/fuse": patch
---

`DatePicker` and `DateRangePicker` no longer dispatch a made-up `focusout` when focus leaves the
picker after a visit to its popup, so an `onBlur` on an element around the picker sees only real
blurs. The input's validation still waits while focus is in the popup and runs once focus leaves
both. A commit that runs when focus leaves now reports the real focus event in `onValueChange`'s
`details.event`.
