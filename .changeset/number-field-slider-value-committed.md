---
"@elmeragroup/fuse": minor
---

`NumberField` and `Slider` take `onValueCommitted`, which reports the value once the user
finishes a change. `onChange` still reports every change.

- `NumberField` commits when the input blurs after typing, when a stepper press ends, and on
  each arrow, Home or End key press. It reports a number, and `NaN` for a cleared input, as
  `onChange` does. Enter does not commit.
- `Slider` commits when a thumb drag or a track press ends, and on each key press. It reports
  the same shape as `onChange`: a number for a single value, and an array of the same length
  for a range.
