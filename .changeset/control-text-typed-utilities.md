---
"@elmeragroup/fuse": patch
---

The md and lg control sizes now set their type with the typed utilities `text-(length:--control-text)` and `leading-(--control-leading)` instead of arbitrary properties. tailwind-merge groups the typed forms with `text-*` and `leading-*`, so a consumer `text-*` or `leading-*` class in `className` now replaces the density type through `cn` on `Button`, `Toggle`, `ToggleGroup.Item`, `Select.Trigger`, `Tabs.Trigger`, `Sidebar.MenuSubButton` and the text-entry boxes. Before, `cn` kept both classes and `<Button className="text-sm">` rendered at `--control-text`.
