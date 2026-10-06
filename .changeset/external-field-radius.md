---
"@elmeragroup/fuse": minor
---

External field boxes now round at 4px for every brand, the corner of the Central design system's text input.

A new theme role, `--radius-field`, rounds `Input`, `Textarea`, the `Select` trigger, `NumberField`, `InputGroup`,
the `Combobox` chips box, `DateField`, `DatePicker`, `SearchField` and the other React Aria field groups. External
themes set it to `0.25rem`, down from the brand radius minus 2px (10px for Fjordkraft and Telinet, 13.2px for
TrøndelagKraft, 6px for Gudbrandsdal Energi). Nothing inside a field rounds more than the field: the `InputGroup`
addon buttons and `<kbd>`, the `SearchField` clear button, the `DatePicker` trigger and the `Combobox` chips and
their remove buttons take at most the field corner. Internal themes alias `--radius-field` to `var(--radius)` and
do not move, and internal fields still follow a `--radius` override on a plain wrapper.

A host without `themes.css` keeps rounding fields with its own `--radius`. For the external corner, set
`--radius-step: 2px` and `--radius-field: 0.25rem`. The Figma sync adds `radius-field` with the corner radius picker.
