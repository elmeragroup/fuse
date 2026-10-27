---
"@elmeragroup/fuse": minor
---

`Field.Root` takes `spacing`. `"group"`, the default, keeps the field gap, which follows density: a bare `Field.Root` still sets its label 12px from its control at dense and 16px at comfortable. `"part"` sets the label 4px from its control at both densities, as `TextField`, `SelectField`, `NumberField`, `PhoneNumberField` and `Slider` do, so a field built from parts, such as one around an `Autocomplete` or an `InputGroup`, lines up with them. Before, matching them took a `gap-1` class. Every `Field.Root` now writes its spacing as `data-spacing`.
