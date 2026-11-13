---
"@elmeragroup/fuse": patch
---

NumberField's stepper buttons now name the field they change: each reads its own name and then the
field's label, such as "Increase Quantity", or the field's `aria-label` when it has no visible
label. `increaseLabel` and `decreaseLabel` still set the first part. Before, every stepper was
named "Increase" or "Decrease" alone, so a touch screen reader user swiping through a form with
several number fields could not tell which field a stepper changed.
