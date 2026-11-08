---
"@elmeragroup/fuse": patch
---

A field box's within focus ring now reads only its own control, the `data-focus-ring-control`
element that is its direct child. Before, any focused control inside it counted, so a
keyboard-focused NumberField in an `InputGroup.Addon` also ringed the outer `InputGroup.Root`.
