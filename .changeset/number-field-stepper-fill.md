---
"@elmeragroup/fuse": patch
---

`NumberField`'s steppers now show the field box's fill instead of painting the page `background`.
Branded themes tint the page and keep the field box on `card`, so the steppers showed a band of
page tint inside the white box. A read-only field's steppers showed the same page fill on its
`muted` box in every theme. A resting stepper now matches its box. Hover and a stepper disabled at
a bound keep the `muted` fill.
