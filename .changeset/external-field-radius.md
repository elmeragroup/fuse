---
"@elmeragroup/fuse": minor
---

External field boxes now round with the brand radius, the corner of the cards and selection rows around them.

A new theme role, `--radius-field`, rounds `Input`, `Textarea`, the `Select` trigger, `NumberField`, `InputGroup`,
the `Combobox` chips box, `DateField`, `DatePicker`, `SearchField` and the other React Aria field groups. It aliases
`var(--radius)` in every variant, so external fields round 2px more than before, when they took the brand radius
minus 2px: 12px for Fjordkraft, Fjordkraft Företag and Telinet, 16px for TrøndelagKraft, 8px for Gudbrandsdal
Energi and 6px for Elmera and Nordic Green Energy. Nothing inside a field rounds more than the field: the
`InputGroup` addon buttons and `<kbd>`, the `SearchField` clear button, the `DatePicker` trigger, the focused date
segments, the `Combobox` chips and their remove buttons and the `PhoneNumberField` country trigger take at most the
field corner. A `ButtonGroup` rounds both outer ends with `rounded-md`, so a field at one end matches a button at
the other. Internal themes do not move, and internal fields still follow a `--radius` override on a plain wrapper.

Each theme rule resolves `--radius-field` against its own `--radius`, as it does `--radius-button`. Set
`--radius-field` on the element that carries the theme attributes to give fields a corner of their own. An external
field does not follow a `--radius` override on a plain wrapper, so set `--radius-field` there too.

A host without `themes.css` keeps rounding fields with its own `--radius`. With the external `--radius-step: 2px`,
fields round with `--radius-field` where the host sets it, and with `--radius` otherwise. The Figma sync adds
`radius-field` with the corner radius picker.
