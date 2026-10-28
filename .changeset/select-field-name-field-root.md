---
"@elmeragroup/fuse": patch
---

`SelectField` forwards `name` to `Field.Root` rather than `Select.Root`, as `AutocompleteField` and
`ComboboxField` do. A `Form` error under that name now shows in the first server-rendered HTML,
rather than only after hydration.
