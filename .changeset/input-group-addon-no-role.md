---
"@elmeragroup/fuse": patch
---

`InputGroup.Addon` no longer renders `role="group"`. `InputGroup.Root` is the one group around the
control, so Autocomplete, Combobox, Command, DataTableFilter, PhoneNumberField and SearchField no
longer nest an unnamed group inside it. A test that found an addon by `role="group"` should query
`[data-slot="input-group-addon"]` instead. When an addon groups several controls that need a shared
name, pass `role="group"` and `aria-label` to it.
