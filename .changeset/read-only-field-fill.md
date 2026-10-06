---
"@elmeragroup/fuse": patch
---

A read-only `Input`, `Textarea`, `TextField`, `TextareaField`, `InputGroup` or
`PhoneNumberField` now paints the muted read-only fill (`bg-muted`) that `DateField`,
`DatePicker`, `SearchField` and `NumberField` already use. Before, it looked exactly like an
editable field, so it invited typing that did nothing. The fill keys off the `readonly`
attribute and leaves a disabled field its disabled fill.
