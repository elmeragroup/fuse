---
"@elmeragroup/fuse": patch
---

A click on an `InputGroup.Addon` focuses `InputGroup.Input` and `InputGroup.Textarea` even when the
control has a custom `data-slot`. A click on the addon of `Command.Input`, `Combobox.Input` or
`Autocomplete.Input` focuses its input when the input has a custom `data-slot` or a `render`
element.
