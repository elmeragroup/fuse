---
"@elmeragroup/ui": patch
---

Give the labeled field composites one owner for the label row, description and error: a package-private `FieldFrame` in `field/`, rendered by TextField, NumberField and TextareaField. No public export is added, and every prop, default and public recipe is unchanged — `textFieldVariants` is still the public recipe PhoneNumberField borrows, and its `labelContainer`/`label`/`container`/`description` slots are now passed to the frame as class arguments.

Rendered class sets are unchanged part-for-part for TextField and TextareaField. NumberField changes on purpose: its pending and success glyphs crossfade like TextField's instead of stacking side by side, so both faces are always mounted in a `relative size-3.5` box and exactly one is opaque, `isSuccess` winning (number-field.md §8.7). Its `isSuccess` prop text changes with it. NumberField also reads the shared `withinFocusRingClass`/`withinFocusRingControlClass` constants rather than resolving the recipe on every render.
