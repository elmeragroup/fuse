---
"@elmeragroup/fuse": minor
---

`ComboboxField` and `AutocompleteField` take `isReadOnly`, which forwards `readOnly` to
`Combobox.Root` and `Autocomplete.Root`. The input stays focusable, takes the muted read-only fill
and its popup still opens to show the options, but choosing one, typing or the clear button keeps
the value, which still submits under `name`.
