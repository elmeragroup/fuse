---
"@elmeragroup/fuse": patch
---

An unchecked `Switch` is now an outlined track: a 1px `--muted-foreground` edge, a
`--muted-foreground` thumb and no fill, so the surface shows through. Before, the unchecked track was
filled with `--input`, which measured 1.08–1.70:1 against light surfaces. The edge and thumb measure
3:1 or more against the page, a card and card-soft in every theme and color scheme (WCAG 2.2 SC
1.4.11). On versus off now reads as outline versus fill, as on `Checkbox` and `Radio`, so the state
no longer depends on the thumb position alone. A checked switch is unchanged: a `--primary` fill
with a `--background` thumb. A disabled switch keeps the shared 50% dim, and an invalid switch shows
the error border.
