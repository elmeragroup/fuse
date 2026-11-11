---
"@elmeragroup/fuse": minor
---

`SelectField` takes `isReadOnly`, which forwards `readOnly` to `Select.Root`. The trigger stays
focusable and its popup still opens to show the options, but choosing one keeps the value, and the
value still submits under `name`.

`Select.Trigger` now takes the muted read-only fill (`bg-muted`) the other field boxes take while
its `Select.Root` is `readOnly`. A disabled read-only trigger keeps its disabled face.
