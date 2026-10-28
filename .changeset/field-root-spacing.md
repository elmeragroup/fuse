---
"@elmeragroup/fuse": minor
---

A vertical `Field.Root` now stacks its label, control, error and description 4px apart at both densities, the stack `TextField`, `SelectField`, `NumberField`, `PhoneNumberField` and `Slider` render. A field built from parts, such as one around an `Autocomplete` or an `InputGroup`, now lines up with them without a `gap-1` class. Before, its label sat 12px from its control at dense and 16px at comfortable. `TextareaField` takes the same stack. A horizontal `Field.Root` keeps `--surface-gap-md` between its control and its label, and a responsive one uses each where it applies. The card `TextField` keeps its own layout and writes `data-variant="card"`.
