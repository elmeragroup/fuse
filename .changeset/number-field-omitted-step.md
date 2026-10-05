---
"@elmeragroup/fuse": patch
---

A `NumberField` with `minValue` and no `step` now submits a typed value such as `99.5` under `minValue={1}`. Base UI defaulted the omitted step to 1 on the hidden form input, so native validation rejected every value off the 1-step grid counted from `minValue`, and the form did not submit. Arrows and steppers still move by 1. An explicit `step` together with `minValue` still requires typed values to land on its grid, as a native number input does, and the `step` JSDoc now says so. Pass `step={1}` to keep accepting whole numbers only.
