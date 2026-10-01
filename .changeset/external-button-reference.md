---
"@elmeragroup/fuse": minor
---

External buttons now match the customer-facing reference button.

At comfortable density, `Button` labels pad 16px at `sm` and 32px at `default` and `lg`, up from 14px. A new
`--control-px-button-*` density family holds that inset. Dense matches the other controls, so dense buttons do
not move, and `xs` keeps its 12px comfortable inset. Text fields, `Select` and `Toggle` keep their inset.
Components that borrow the Button recipe move too, including `Pagination` Previous/Next, the `DatePicker`
presets, `FileTrigger` and `InputGroup.Button` at `size="sm"`. A `px-*` class in `className` still replaces
the inset.

The `outline` variant takes its border from two new theme roles, `--button-outline` and
`--button-outline-width`. External themes draw a 2px ring in `--foreground` with no shadow, in light and dark.
Internal themes keep the 1px `--border` hairline and its `shadow-xs`.
