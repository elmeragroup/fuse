---
"@elmeragroup/ui": minor
---

`DropdownMenu.RadioGroup` now ties `value`, `defaultValue` and `onValueChange` to one
string union instead of Base UI's `any`. The selected value and the change handler agree
by type, so `onValueChange` receives the group's own union rather than `any`. Item values
are not checked against it; `DropdownMenu.RadioItem` keeps Base UI's `any`.
