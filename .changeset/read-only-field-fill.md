---
"@elmeragroup/fuse": patch
---

A read-only `Input`, `Textarea`, `TextField`, `TextareaField`, `InputGroup`, `PhoneNumberField`,
`Combobox` or `SearchField` now paints the muted read-only fill (`bg-muted`) that `DateField`,
`DatePicker` and `NumberField` already use. Before, it looked exactly like an editable field, so
it invited typing that did nothing. Under `TextField variant="card"` the card takes the fill, and
under `variant="inline"` the field keeps it at rest and on hover. The fill keys off the `readonly`
attribute and leaves a disabled field its disabled fill.
