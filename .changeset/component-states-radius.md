---
"@elmeragroup/fuse": minor
---

Disabled `Checkbox`, `RadioGroupItem` and `RadioIconButton` now dim to 50%. A disabled `Button` that renders another element or sets `focusableWhenDisabled` dims too and keeps pointer events, so its tooltip still opens.

External standalone buttons round with `--radius-button`, so Fjordkraft, Fjordkraft Företag and Telinet buttons become pills. Buttons in a group, a field or a preset list keep their corner. Internal themes round every element with `--radius`. Override `--radius` on `<html>` or a `ThemeScope` to move buttons, cards and fields together.

New `--radius-step` and `--secondary-hover` roles. `Badge` has no hover styles.
