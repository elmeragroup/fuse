---
"@elmeragroup/fuse": patch
---

An explicit `aria-label` now wins on `Combobox.Clear` and `DatePickerPresetGroup`. When a wrapper
forwards `id` or `aria-labelledby` as `undefined`, `TextareaField` keeps its Field label and
`TextField` keeps its `aria-labelledby` wiring.
