---
"@elmeragroup/fuse": minor
---

Disabled `Checkbox`, `RadioGroupItem` and `RadioIconButton` now dim to 50%, standalone and inside `CheckboxItem` and `RadioItem` shells. A disabled `Button` that renders another element or sets `focusableWhenDisabled` dims too and keeps its pointer events, so a tooltip on it still opens.

`Button` rounds every size with `--radius-button`, so external buttons of every brand follow it, and Fjordkraft, Fjordkraft Företag and Telinet buttons become pills. Buttons in a `ButtonGroup` keep the group radius. Internal themes round every element with `--radius` and leave `--radius-button` unset.

New `--radius-step` and `--secondary-hover` roles. `Badge` has no hover styles.
