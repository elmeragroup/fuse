---
"@elmeragroup/fuse": patch
---

A pressed `Toggle` and `ToggleGroup.Item` now fill with `--primary` and set their label in
`--primary-foreground`, in both variants. Before, a pressed toggle filled with `--muted`, the same
tint as hover: it measured 1.03–1.09:1 against the page or card beside it, and a hovered toggle
looked pressed. Hover still tints an unpressed toggle with `--muted`, and a pressed toggle keeps
its face under the pointer.
