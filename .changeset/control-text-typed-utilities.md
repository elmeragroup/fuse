---
"@elmeragroup/fuse": patch
---

The md and lg control sizes now set their type with the typed utilities `text-(length:--control-text)` and `leading-(--control-leading)` instead of arbitrary properties. A consumer `text-*` or `leading-*` class in `className` now replaces the density type on `Button`, `Toggle`, `ToggleGroup.Item`, `Select.Trigger`, `Tabs.Trigger` and the text-entry boxes, both through `cn` and in the cascade. Before, `<Button className="text-sm">` kept rendering at `--control-text`.
