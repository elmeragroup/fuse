---
"@elmeragroup/fuse": patch
---

`PhoneNumberField` now names the group around its country picker and number after the field: its
label, or its `aria-labelledby` or `aria-label` when it has no label. Screen readers read the
"Select country" button in that field's context, which tells apart several phone fields in one form.

`NumberField` no longer marks the box around its input and steppers as an unnamed `group`. The
steppers are out of the tab order, so the input is the field's only tab stop and already carries
its name. The box keeps its element, `aria-invalid` and styling.
