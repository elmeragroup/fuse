---
"@elmeragroup/fuse": minor
---

`Popover.Content` takes `collisionPadding` and `collisionAvoidance` and passes them to its
positioner. `collisionPadding` sets how far the popup stays from the viewport edge, such as
`{ top: 64 }` to clear a sticky header. `collisionAvoidance` picks whether the popup flips or shifts
when it would cross that edge. `DatePicker.Popup` and `DateRangePicker.Popup` take the same props.
