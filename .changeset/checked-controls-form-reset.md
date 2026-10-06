---
"@elmeragroup/fuse": patch
---

`Checkbox`, `Switch`, `CheckboxCard`, `RadioGroup` and `CheckboxGroup` now submit what they show after a native form reset, including React's reset after a form action. Before, the reset put their hidden inputs back to their mount-time state while the controls kept showing the user's choices, so the next submit sent different data from what was on screen. The controls keep their current selection on reset; an uncontrolled one does not return to `defaultChecked` or `defaultValue`.
