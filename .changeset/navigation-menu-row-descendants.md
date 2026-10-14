---
"@elmeragroup/fuse": patch
---

`NavigationMenu`: a hovered link row in a content panel, and a hovered or open vertical trigger,
recolour their descendants to `--accent-foreground`, as Select, Combobox and DropdownMenu items
do. A `text-muted-foreground` description inside such a row measured 4.43:1 on light `--accent`,
under the 4.5:1 text floor (WCAG 2.2 SC 1.4.3). The vertical trigger's caret takes the same
colour while the row is highlighted.
