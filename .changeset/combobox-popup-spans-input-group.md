---
"@elmeragroup/fuse": patch
---

The `Combobox.Content` popup under `Combobox.Input` now spans the whole field box, trailing caret
and clear buttons included, as `Autocomplete.Content` does. Before, it was positioned against the
`<input>` inside the box and was at least that input's width plus 28px, so its right edge stopped
short of the box's. `Combobox.Input` now renders its InputGroup through Base UI's
`Combobox.InputGroup`, so a press on the field box outside its controls focuses the input and,
under `openOnInputClick`, opens the popup; a disabled `Combobox.Input` ignores it. A popup with an
external `anchor`, such as `Combobox.Chips`, is unchanged.
