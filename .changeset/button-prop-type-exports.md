---
"@elmeragroup/fuse": minor
---

`@elmeragroup/fuse/button` exports `LabelButtonProps`, `IconButtonProps`, `ButtonSize`, `LabelButtonSize` and `IconButtonSize`. `ButtonProps` is now the union of the first two. A wrapper that supplies its own label types its props as `Omit<LabelButtonProps, "children">`, which keeps icon sizes out and the size list in sync with the recipe, where `Omit<ButtonProps, …>` collapsed the union and let `size="icon"` through without an `aria-label`.
