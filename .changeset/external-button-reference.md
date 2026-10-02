---
"@elmeragroup/fuse": minor
---

External buttons now match the customer-facing reference button.

At comfortable density, `Button` labels pad 16px at `sm` and 32px at `default` and `lg`, up from 14px. The side
of a leading or trailing icon pads 12px at `sm` and 24px at `default` and `lg`, up from 10px and 12px. New
`--control-px-button-*` and `--control-px-button-icon-*` density families hold those values. Dense matches the
other controls, so dense buttons do not move, and `xs` keeps its comfortable values. Text fields, `Select`,
`Toggle` and `InputGroup.Button` keep their padding. Components that borrow the Button recipe move too,
including `Pagination` Previous/Next, the `DatePicker` presets and `FileTrigger`. A `px-*` class in
`className` still replaces the inset.

The `outline` variant takes its border from two new theme roles, `--button-outline` and
`--button-outline-width`. External themes draw a 2px ring in `--foreground` with no shadow, in light and dark.
Internal themes keep the 1px `--border` hairline and its `shadow-xs`.
