---
"@elmeragroup/ui": minor
---

`NumberField` treats an absent `value` as uncontrolled, matching React's convention. Pass `NaN` for a controlled empty field.

- A bare `<NumberField label onChange />` (no `value`, no `defaultValue`) now steps from empty instead of being locked as a controlled empty field that could not step.
- Migration: a controlled field that starts empty should use `useState<number>(NaN)` rather than `useState<number>()`; `value={undefined}` no longer means controlled-empty.
