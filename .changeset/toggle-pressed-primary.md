---
"@elmeragroup/fuse": patch
---

In external themes, a pressed `Toggle` and `ToggleGroup.Item` now fill with `--primary` and set
their label in `--primary-foreground`, in both the default and outline variants. Before, a pressed
toggle filled with `--muted`, the same tint as hover: it measured 1.03–1.09:1 against the tinted
brand page or the card beside it, and a hovered toggle looked pressed. Hover still tints an
unpressed toggle with `--muted`, apart from the pressed fill, and a pressed toggle keeps its face
under the pointer.
