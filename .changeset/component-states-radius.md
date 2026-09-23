---
"@elmeragroup/fuse": minor
---

Disabled `Checkbox`, `RadioGroupItem` and `RadioIconButton` now dim to 50% on their own. Base UI renders their roots as a `<span>`, which `disabled:` never matched, so a standalone disabled control stayed at full opacity. A disabled `Button` that renders another element, such as `render={<a />}`, now dims too. A disabled `Radio` row dims its control and its label text once each instead of compounding to 25%.

Buttons of every size, the icon sizes included, now round with the theme's `--radius-button`. The `xs` and `sm` clamps are gone, so external Fjordkraft and Telinet buttons render as pills and TrøndelagKraft buttons follow its 0.95rem radius. A button inside `ButtonGroup` keeps the group's `rounded-md` silhouette.

The internal variant now rounds every element with one radius. The new `--radius-step` token sets the spacing of the `rounded-*` scale. External themes keep 2px steps, so their cards, fields and overlays do not change. Internal themes use `0px`, so buttons, cards, inputs, overlays and menu items all resolve to `--radius` (0.375rem), and internal `--radius-button` reads `var(--radius)`. The 16px `Checkbox` keeps its 4px cap. `InputGroup` addon buttons of every size, the phone country trigger and the standalone `Calendar` card moved onto the theme scale, so the `Calendar` card now follows the brand radius. Clamped radii no longer read variables resolved at the document root, so a nested `ThemeScope` rounds from its own radius.

The new `--secondary-hover` role, with the `bg-secondary-hover` utility, is `secondary` mixed 5% toward `foreground` in OKLCH, computed for every theme and scheme. The secondary `Button` hover uses it and paints the same color as before.

`Badge` no longer changes color on hover, because it is a non-interactive `<div>`.
