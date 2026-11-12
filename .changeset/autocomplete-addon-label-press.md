---
"@elmeragroup/fuse": patch
---

A press on a label or another element that owns its press, inside a custom `InputGroup.Addon` in
`Autocomplete.Input`, now goes to that element. Before, the autocomplete input took focus and, with
`openOnInputClick`, the popup opened and closed again before the label focused its own control.
