---
"@elmeragroup/fuse": minor
---

`Field.Description` now works outside a `Field.Root`. Inside a `Field.Set`, it describes
the fieldset through `aria-describedby`, after any `aria-describedby` you pass to the set, so a
description can follow a `Field.Legend`. Elsewhere it renders the same paragraph without wiring.
Before, it threw "FieldRootContext is missing" outside a `Field.Root`. Inside a `Field.Root` it
still describes the field's control.
