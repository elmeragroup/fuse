---
"@elmeragroup/fuse": patch
---

A focused `InputGroup` and the React Aria `DateField`, `DatePicker`, `DateRangePicker` and `SearchField`
keep their `--input` border under the focus ring, as `Input`, `Textarea`, `Select` and `NumberField` do.
They used to turn the border `--ring` as well, so a field with an active ring drew two ring-coloured
lines with the offset gap between them. That covered every `InputGroup` field, including
`Combobox.Input` and `PhoneNumberField`. Clicking into a date segment no longer turns the border
`--ring` without drawing the ring. An invalid field keeps its `--error` border and invalid ring while
focused.
