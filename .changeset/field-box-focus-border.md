---
"@elmeragroup/fuse": patch
---

A focused `InputGroup`, `DateField`, `DatePicker` and `DateRangePicker`
keep their `--input` border under the focus ring, as `Input`, `Textarea`, `Select` and `NumberField` do.
They used to turn the border `--ring` as well, so a field with an active ring drew two ring-coloured
lines with the offset gap between them. That covered every `InputGroup` field, including
`Combobox.Input` and `PhoneNumberField`. An invalid field keeps its `--error` border and invalid ring while
focused.
