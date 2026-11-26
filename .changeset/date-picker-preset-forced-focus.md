---
"@elmeragroup/fuse": patch
---

A keyboard-focused `DatePicker.PresetItem` or `DateRangePicker.PresetItem` now draws a focus outline
in forced-colors mode. Before, the preset's focus ring was a `box-shadow`, which forced-colors mode
drops, so a focused preset showed no focus indicator under Windows High Contrast. The preset now
takes the shared focus ring, so in normal mode its ring is the 2px solid `--ring` that other
controls draw, in place of a 3px ring at 50% opacity.
The ring reads the preset's radio as the label's direct child, so a `render` element or callback
that wraps the preset's children inside the label hides keyboard focus.
